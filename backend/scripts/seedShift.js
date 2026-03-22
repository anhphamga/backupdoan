const fs = require('fs');
const path = require('path');
const requireFromWorkspace = (moduleName) => {
    try {
        return require(moduleName);
    } catch {
        return require(path.resolve(__dirname, `../../BE/node_modules/${moduleName}`));
    }
};

const mongoose = requireFromWorkspace('mongoose');
const dotenv = requireFromWorkspace('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../BE/.env') });
dotenv.config();

const Shift = require('../../BE/model/Shift.model');
const ShiftAssignment = require('../../BE/model/ShiftAssignment.model');
const User = require('../../BE/model/User.model');

const SEED_DIR = path.resolve(__dirname, '../data/seeds');
const SHIFTS_FILE = path.join(SEED_DIR, 'shifts.json');
const ASSIGNMENTS_FILE = path.join(SEED_DIR, 'shift_assignments.json');
const FALLBACK_STAFF_ID = '000000000000000000000001';
const AUTO_STAFF_TOKEN = '__AUTO_STAFF_ID__';

const readJson = (filePath) => {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Seed file not found: ${filePath}`);
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

const toDateTime = (workDate, time) => {
    const parsed = new Date(`${workDate}T${time}:00`);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error(`Invalid date/time value: ${workDate} ${time}`);
    }
    return parsed;
};

const normalizeShiftDocs = (rows = []) => (
    rows.map((item) => {
        const workDate = String(item.workDate || '').trim();
        const startTime = String(item.startTime || '').trim();
        const endTime = String(item.endTime || '').trim();
        const startAt = toDateTime(workDate, startTime);
        const endAt = toDateTime(workDate, endTime);

        return {
            code: String(item.code || '').trim(),
            name: String(item.name || '').trim(),
            title: String(item.name || item.title || '').trim(),
            workDate,
            startTime,
            endTime,
            startAt,
            endAt,
            maxStaff: Number(item.maxStaff || 0),
            assignedCount: Number(item.assignedCount || 0),
            status: String(item.status || 'OPEN').trim(),
            allowRegistration: item.allowRegistration !== false,
        };
    })
);

const resolveStaffId = async () => {
    const staff = await User.findOne({ role: 'staff' }).select('_id').lean();
    if (staff?._id) return staff._id.toString();
    return FALLBACK_STAFF_ID;
};

const normalizeAssignments = ({ rows = [], shiftMap = new Map(), staffId }) => (
    rows
        .map((item) => {
            const shiftCode = String(item.shiftCode || '').trim();
            const shiftId = shiftMap.get(shiftCode);
            if (!shiftId) return null;

            const rawStaffId = String(item.staffId || '').trim();
            const resolvedStaffId = rawStaffId === AUTO_STAFF_TOKEN || !rawStaffId
                ? staffId
                : rawStaffId;

            if (!mongoose.isValidObjectId(resolvedStaffId)) return null;

            return {
                shiftId,
                shiftCode,
                staffId: new mongoose.Types.ObjectId(resolvedStaffId),
                status: String(item.status || 'PENDING').trim(),
                attendanceStatus: String(item.attendanceStatus || 'NOT_CHECKED_IN').trim(),
            };
        })
        .filter(Boolean)
);

const updateAssignedCount = async () => {
    const counts = await ShiftAssignment.aggregate([
        { $group: { _id: '$shiftId', count: { $sum: 1 } } },
    ]);

    const countMap = new Map(counts.map((item) => [String(item._id), Number(item.count || 0)]));
    const shifts = await Shift.find({}).select('_id').lean();

    await Promise.all(
        shifts.map((shift) => Shift.updateOne(
            { _id: shift._id },
            { $set: { assignedCount: countMap.get(String(shift._id)) || 0 } }
        ))
    );
};

const run = async () => {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        throw new Error('MONGODB_URI is missing');
    }

    const shiftRows = readJson(SHIFTS_FILE);
    const assignmentRows = readJson(ASSIGNMENTS_FILE);

    await mongoose.connect(mongoUri);
    console.log(`MongoDB connected: ${mongoUri}`);

    await ShiftAssignment.deleteMany({});
    await Shift.deleteMany({});

    const insertedShifts = await Shift.insertMany(normalizeShiftDocs(shiftRows));
    console.log('Seed shifts success');

    const shiftMap = new Map(insertedShifts.map((item) => [item.code, item._id]));
    const staffId = await resolveStaffId();
    const assignmentDocs = normalizeAssignments({
        rows: assignmentRows,
        shiftMap,
        staffId,
    });

    if (assignmentDocs.length > 0) {
        await ShiftAssignment.insertMany(assignmentDocs);
        await updateAssignedCount();
    }
    console.log('Seed assignments success');
};

run()
    .then(async () => {
        await mongoose.disconnect();
        process.exit(0);
    })
    .catch(async (error) => {
        console.error(`seedShift failed: ${error.message}`);
        try {
            await mongoose.disconnect();
        } catch {
            // ignore disconnect errors
        }
        process.exit(1);
    });
