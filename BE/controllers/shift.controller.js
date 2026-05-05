const mongoose = require('mongoose');
const Shift = require('../model/Shift.model');
const ShiftRegistration = require('../model/ShiftRegistration.model');
const { recomputeShiftStatus, sanitizeShiftForStaff, getActiveShiftForStaff } = require('../services/shift.service');

const { SHIFT_STATUS } = Shift;
const { SHIFT_REGISTRATION_STATUS } = ShiftRegistration;

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const SHIFT_MAX_REQUIRED_STAFF = Math.max(Number(process.env.SHIFT_MAX_REQUIRED_STAFF || 20), 1);
const CHECKIN_EARLY_MINUTES = Math.max(Number(process.env.SHIFT_CHECKIN_EARLY_MINUTES || 15), 0);
const CHECKOUT_EARLY_MINUTES = Math.max(Number(process.env.SHIFT_CHECKOUT_EARLY_MINUTES || 30), 0);

const parseTimeToMinutes = (timeText) => {
  const text = String(timeText || '').trim();
  if (!TIME_REGEX.test(text)) {
    return null;
  }
  const [hours, minutes] = text.split(':').map((value) => Number(value));
  return hours * 60 + minutes;
};

const normalizeShiftDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
};

const getDayRange = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

const isOverlap = (startA, endA, startB, endB) => {
  return startA < endB && startB < endA;
};

const buildDateTimeFromShift = (shiftDate, timeText) => {
  const minutes = parseTimeToMinutes(timeText);
  if (minutes === null) return null;
  const at = new Date(shiftDate);
  at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return Number.isNaN(at.getTime()) ? null : at;
};

const normalizeRole = (role) => String(role || '').trim().toLowerCase();

const createShift = async (req, res) => {
  try {
    const { date, startTime, endTime, requiredStaff } = req.body || {};

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn ngày.',
      });
    }

    const shiftDate = normalizeShiftDate(date);
    if (!shiftDate) {
      return res.status(400).json({
        success: false,
        message: 'Ngày không hợp lệ (ví dụ: 2026-04-23).',
      });
    }

    const startMinutes = parseTimeToMinutes(startTime);
    const endMinutes = parseTimeToMinutes(endTime);
    if (startMinutes === null || endMinutes === null) {
      return res.status(400).json({
        success: false,
        message: 'Giờ bắt đầu/giờ kết thúc phải đúng định dạng HH:mm (ví dụ: 08:30).',
      });
    }

    if (startMinutes >= endMinutes) {
      return res.status(400).json({
        success: false,
        message: 'Giờ bắt đầu phải nhỏ hơn giờ kết thúc.',
      });
    }

    const normalizedRequiredStaff = Number(requiredStaff);
    if (!Number.isInteger(normalizedRequiredStaff) || normalizedRequiredStaff < 1) {
      return res.status(400).json({
        success: false,
        message: 'Số lượng nhân sự phải là số nguyên và >= 1.',
      });
    }

    if (normalizedRequiredStaff > SHIFT_MAX_REQUIRED_STAFF) {
      return res.status(400).json({
        success: false,
        message: `Số lượng nhân sự tối đa cho một ca là ${SHIFT_MAX_REQUIRED_STAFF}.`,
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (shiftDate.getTime() < today.getTime()) {
      return res.status(400).json({
        success: false,
        message: 'Không thể tạo ca làm trong quá khứ.',
      });
    }
    if (shiftDate.getTime() === today.getTime()) {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      if (startMinutes <= nowMinutes) {
        return res.status(400).json({
          success: false,
          message: 'Không thể tạo ca làm đã bắt đầu trong hôm nay.',
        });
      }
      if (endMinutes <= nowMinutes) {
        return res.status(400).json({
          success: false,
          message: 'Không thể tạo ca làm đã kết thúc trong hôm nay.',
        });
      }
    }
    // Không cho tạo ca trùng/đè thời gian trong cùng ngày
    const { start, end } = getDayRange(shiftDate);
    const existingShifts = await Shift.find({
      date: { $gte: start, $lt: end },
    }).select('startTime endTime');

    const hasOverlap = existingShifts.some((other) => {
      const otherStart = parseTimeToMinutes(other.startTime);
      const otherEnd = parseTimeToMinutes(other.endTime);
      if (otherStart === null || otherEnd === null) return false;
      return isOverlap(startMinutes, endMinutes, otherStart, otherEnd);
    });

    if (hasOverlap) {
      return res.status(409).json({
        success: false,
        message: 'Thời gian ca bị trùng với ca khác trong cùng ngày.',
      });
    }

    const created = await Shift.create({
      date: shiftDate,
      startTime: String(startTime).trim(),
      endTime: String(endTime).trim(),
      requiredStaff: normalizedRequiredStaff,
      assignedStaffIds: [],
      status: SHIFT_STATUS.OPEN,
    });

    return res.status(201).json({
      success: true,
      message: 'Tạo ca làm thành công.',
      data: created,
    });
  } catch (error) {
    const duplicate = error?.code === 11000;
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'Ca làm đã tồn tại (trùng ngày/giờ bắt đầu/giờ kết thúc).',
      });
    }

    console.error('Create shift error:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể tạo ca làm lúc này.',
    });
  }
};
const getShifts = async (req, res) => {
  try {
    const { date } = req.query || {};
    const filter = {};

    if (date) {
      const shiftDate = normalizeShiftDate(date);
      if (!shiftDate) {
        return res.status(400).json({
          success: false,
          message: 'date không hợp lệ (ví dụ: 2026-04-23).',
        });
      }
      const { start, end } = getDayRange(shiftDate);
      filter.date = { $gte: start, $lt: end };
    }

    const limit = Math.min(Math.max(Number(req.query?.limit || 100), 1), 200);
    const page = Math.max(Number(req.query?.page || 1), 1);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Shift.find(filter)
        .sort({ date: 1, startTime: 1 })
        .skip(skip)
        .limit(limit),
      Shift.countDocuments(filter),
    ]);

    const role = normalizeRole(req.user?.role);
    const safeItems = role === 'staff'
      ? items.map((shift) => sanitizeShiftForStaff(shift))
      : items;

    return res.json({
      success: true,
      message: 'Lấy danh sách ca làm thành công.',
      data: {
        items: safeItems,
        pagination: {
          page,
          limit,
          total,
        },
      },
    });
  } catch (error) {
    console.error('Get shifts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể lấy danh sách ca làm lúc này.',
    });
  }
};

const registerShift = async (req, res) => {
  try {
    const staffId = req.user?.id;
    const { shiftId } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(shiftId)) {
      return res.status(400).json({
        success: false,
        message: 'shiftId không hợp lệ.',
      });
    }

    const shift = await Shift.findById(shiftId);
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy ca làm.',
      });
    }

    const syncedStatus = recomputeShiftStatus(shift);
    if (syncedStatus !== shift.status) {
      shift.status = syncedStatus;
      await shift.save().catch(() => null);
    }

    if (shift.status === SHIFT_STATUS.CLOSED) {
      return res.status(400).json({
        success: false,
        message: 'Ca làm đã đóng, không thể đăng ký.',
      });
    }

    const assignedCount = Array.isArray(shift.assignedStaffIds) ? shift.assignedStaffIds.length : 0;
    if (assignedCount >= Number(shift.requiredStaff || 0) || shift.status === SHIFT_STATUS.FULL) {
      return res.status(400).json({
        success: false,
        message: 'Ca làm đã đủ người, không thể đăng ký.',
      });
    }

    const existing = await ShiftRegistration.findOne({ shiftId, staffId });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Bạn đã đăng ký ca làm này rồi.',
        data: existing,
      });
    }

    const targetStart = parseTimeToMinutes(shift.startTime);
    const targetEnd = parseTimeToMinutes(shift.endTime);
    if (targetStart === null || targetEnd === null) {
      return res.status(500).json({
        success: false,
        message: 'Dữ liệu thời gian ca làm không hợp lệ.',
      });
    }

    const created = await ShiftRegistration.create({
      shiftId: shift._id,
      staffId,
      status: SHIFT_REGISTRATION_STATUS.PENDING,
    });

    return res.status(201).json({
      success: true,
      message: 'Đăng ký ca làm thành công, vui lòng chờ Owner duyệt.',
      data: created,
    });
  } catch (error) {
    const duplicate = error?.code === 11000;
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'Bạn đã đăng ký ca làm này rồi.',
      });
    }

    console.error('Register shift error:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể đăng ký ca làm lúc này.',
    });
  }
};

const approveShiftRegistration = async (req, res) => {
  const buildError = (httpCode, message) => {
    const error = new Error(message);
    error.httpCode = httpCode;
    return error;
  };

  try {
    const { registrationId, status } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(registrationId)) {
      return res.status(400).json({
        success: false,
        message: 'registrationId không hợp lệ.',
      });
    }

    const desiredStatus = String(status || SHIFT_REGISTRATION_STATUS.APPROVED).trim().toUpperCase();
    const allowedTargetStatuses = [SHIFT_REGISTRATION_STATUS.APPROVED, SHIFT_REGISTRATION_STATUS.REJECTED];
    if (!allowedTargetStatuses.includes(desiredStatus)) {
      return res.status(400).json({
        success: false,
        message: `status không hợp lệ. Cho phép: ${allowedTargetStatuses.join(', ')}`,
      });
    }

    const attemptApprove = async (session) => {
      const registration = await ShiftRegistration.findById(registrationId).session(session);
      if (!registration) {
        throw buildError(404, 'Không tìm thấy đăng ký ca làm.');
      }

      if (registration.status !== SHIFT_REGISTRATION_STATUS.PENDING) {
        throw buildError(400, 'Đăng ký này đã được xử lý trước đó, không thể thay đổi.');
      }

      const shift = await Shift.findById(registration.shiftId).session(session);
      if (!shift) {
        throw buildError(404, 'Không tìm thấy ca làm.');
      }

      if (shift.status === SHIFT_STATUS.CLOSED) {
        throw buildError(400, 'Ca làm đã đóng, không thể duyệt.');
      }

      if (desiredStatus === SHIFT_REGISTRATION_STATUS.REJECTED) {
        const updated = await ShiftRegistration.updateOne(
          { _id: registration._id, status: SHIFT_REGISTRATION_STATUS.PENDING },
          { $set: { status: SHIFT_REGISTRATION_STATUS.REJECTED } },
          { session }
        );
        if (updated.modifiedCount !== 1) {
          throw buildError(409, 'Đăng ký đã được xử lý bởi yêu cầu khác.');
        }

        const freshRegistration = await ShiftRegistration.findById(registration._id).session(session);
        const freshShift = await Shift.findById(shift._id).session(session);
        return { registration: freshRegistration, shift: freshShift };
      }
      // Không duyệt nếu nhân viên có ca khác bị trùng giờ
      const targetStart = parseTimeToMinutes(shift.startTime);
      const targetEnd = parseTimeToMinutes(shift.endTime);
      if (targetStart === null || targetEnd === null) {
        throw buildError(500, 'Dữ liệu thời gian ca làm không hợp lệ.');
      }

      const { start, end } = getDayRange(shift.date);
      const approvedShiftIds = await ShiftRegistration.find({
        staffId: registration.staffId,
        status: SHIFT_REGISTRATION_STATUS.APPROVED,
        shiftId: { $ne: shift._id },
      }).distinct('shiftId').session(session);

      if (approvedShiftIds.length > 0) {
        const sameDayApprovedShifts = await Shift.find({
          _id: { $in: approvedShiftIds },
          date: { $gte: start, $lt: end },
          status: { $ne: SHIFT_STATUS.CLOSED },
        }).select('startTime endTime').session(session);

        const hasOverlap = sameDayApprovedShifts.some((other) => {
          const otherStart = parseTimeToMinutes(other.startTime);
          const otherEnd = parseTimeToMinutes(other.endTime);
          if (otherStart === null || otherEnd === null) return false;
          return isOverlap(targetStart, targetEnd, otherStart, otherEnd);
        });

        if (hasOverlap) {
          throw buildError(400, 'Nhân viên đã có ca khác trùng giờ, không thể duyệt.');
        }
      }

      // APPROVED: capacity-safe atomic add (prevents over-assign in concurrency)
      const updatedShift = await Shift.findOneAndUpdate(
        {
          _id: shift._id,
          status: { $ne: SHIFT_STATUS.CLOSED },
          $expr: { $lt: [{ $size: '$assignedStaffIds' }, '$requiredStaff'] },
        },
        { $addToSet: { assignedStaffIds: registration.staffId } },
        { new: true, session }
      );

      if (!updatedShift) {
        throw buildError(400, 'Ca làm đã đủ người, không thể duyệt thêm.');
      }

      const updatedReg = await ShiftRegistration.updateOne(
        { _id: registration._id, status: SHIFT_REGISTRATION_STATUS.PENDING },
        { $set: { status: SHIFT_REGISTRATION_STATUS.APPROVED } },
        { session }
      );

      if (updatedReg.modifiedCount !== 1) {
        // In transaction this will rollback; in fallback we will compensate.
        throw buildError(409, 'Đăng ký đã được xử lý bởi yêu cầu khác.');
      }

      const nextStatus = recomputeShiftStatus(updatedShift);
      if (nextStatus !== updatedShift.status) {
        await Shift.updateOne(
          { _id: updatedShift._id, status: { $ne: SHIFT_STATUS.CLOSED } },
          { $set: { status: nextStatus } },
          { session }
        );
        updatedShift.status = nextStatus;
      }

      const freshRegistration = await ShiftRegistration.findById(registration._id).session(session);
      return { registration: freshRegistration, shift: updatedShift };
    };

    let result;
    let session;
    try {
      session = await mongoose.startSession();
      await session.withTransaction(async () => {
        result = await attemptApprove(session);
      });
    } catch (error) {
      // Fallback for standalone MongoDB without transaction support.
      const message = String(error?.message || '');
      const isTxnUnsupported = message.includes('Transaction') || message.includes('replica set') || message.includes('mongos');
      if (!isTxnUnsupported) {
        throw error;
      }

      const registration = await ShiftRegistration.findById(registrationId);
      if (!registration) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký ca làm.' });
      }
      if (registration.status !== SHIFT_REGISTRATION_STATUS.PENDING) {
        return res.status(400).json({ success: false, message: 'Đăng ký này đã được xử lý trước đó, không thể thay đổi.' });
      }

      const shift = await Shift.findById(registration.shiftId);
      if (!shift) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy ca làm.' });
      }
      if (shift.status === SHIFT_STATUS.CLOSED) {
        return res.status(400).json({ success: false, message: 'Ca làm đã đóng, không thể duyệt.' });
      }

      if (desiredStatus === SHIFT_REGISTRATION_STATUS.REJECTED) {
        const updated = await ShiftRegistration.updateOne(
          { _id: registration._id, status: SHIFT_REGISTRATION_STATUS.PENDING },
          { $set: { status: SHIFT_REGISTRATION_STATUS.REJECTED } }
        );
        if (updated.modifiedCount !== 1) {
          return res.status(409).json({ success: false, message: 'Đăng ký đã được xử lý bởi yêu cầu khác.' });
        }
        const freshRegistration = await ShiftRegistration.findById(registration._id);
        const freshShift = await Shift.findById(shift._id);
        result = { registration: freshRegistration, shift: freshShift };
      } else {
        const updatedShift = await Shift.findOneAndUpdate(
          {
            _id: shift._id,
            status: { $ne: SHIFT_STATUS.CLOSED },
            $expr: { $lt: [{ $size: '$assignedStaffIds' }, '$requiredStaff'] },
          },
          { $addToSet: { assignedStaffIds: registration.staffId } },
          { new: true }
        );

        if (!updatedShift) {
          return res.status(400).json({ success: false, message: 'Ca làm đã đủ người, không thể duyệt thêm.' });
        }

        const updatedReg = await ShiftRegistration.updateOne(
          { _id: registration._id, status: SHIFT_REGISTRATION_STATUS.PENDING },
          { $set: { status: SHIFT_REGISTRATION_STATUS.APPROVED } }
        );

        if (updatedReg.modifiedCount !== 1) {
          // compensate best-effort to avoid leaving shift assigned without APPROVED registration
          await Shift.updateOne({ _id: updatedShift._id }, { $pull: { assignedStaffIds: registration.staffId } }).catch(() => null);
          return res.status(409).json({ success: false, message: 'Đăng ký đã được xử lý bởi yêu cầu khác.' });
        }

        const nextStatus = recomputeShiftStatus(updatedShift);
        if (nextStatus !== updatedShift.status) {
          await Shift.updateOne(
            { _id: updatedShift._id, status: { $ne: SHIFT_STATUS.CLOSED } },
            { $set: { status: nextStatus } }
          ).catch(() => null);
          updatedShift.status = nextStatus;
        }

        const freshRegistration = await ShiftRegistration.findById(registration._id);
        result = { registration: freshRegistration, shift: updatedShift };
      }
    } finally {
      if (session) {
        session.endSession();
      }
    }

    return res.json({
      success: true,
      message: 'Cập nhật trạng thái đăng ký thành công.',
      data: result,
    });
  } catch (error) {
    const httpCode = Number(error?.httpCode || 0);
    if (httpCode) {
      return res.status(httpCode).json({
        success: false,
        message: error.message || 'Yêu cầu không hợp lệ.',
      });
    }

    console.error('Approve shift registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể cập nhật trạng thái đăng ký lúc này.',
    });
  }
};

const checkIn = async (req, res) => {
  try {
    const staffId = req.user?.id;
    const { shiftId } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(shiftId)) {
      return res.status(400).json({
        success: false,
        message: 'shiftId không hợp lệ.',
      });
    }

    const registration = await ShiftRegistration.findOne({ shiftId, staffId });
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đăng ký ca làm.',
      });
    }

    if (registration.status !== SHIFT_REGISTRATION_STATUS.APPROVED) {
      return res.status(403).json({
        success: false,
        message: 'Bạn chưa được duyệt ca này nên không thể check-in.',
      });
    }

    const shift = await Shift.findById(registration.shiftId);
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy ca làm.',
      });
    }

    if (shift.status === SHIFT_STATUS.CLOSED) {
      return res.status(400).json({
        success: false,
        message: 'Ca làm đã đóng, không thể check-in.',
      });
    }

    const shiftStartAt = buildDateTimeFromShift(shift.date, shift.startTime);
    if (shiftStartAt) {
      const earliest = shiftStartAt.getTime() - CHECKIN_EARLY_MINUTES * 60 * 1000;
      if (Date.now() < earliest) {
        return res.status(400).json({
          success: false,
          message: `Bạn chỉ có thể check-in trước tối đa ${CHECKIN_EARLY_MINUTES} phút.`,
        });
      }
    }

    const endMinutes = parseTimeToMinutes(shift.endTime);
    if (endMinutes !== null) {
      const endAt = new Date(shift.date);
      endAt.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
      if (!Number.isNaN(endAt.getTime()) && Date.now() > endAt.getTime()) {
        return res.status(400).json({
          success: false,
          message: 'Ca làm đã hết giờ, không thể check-in.',
        });
      }
    }
if (registration.checkInAt) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã check-in ca này rồi.',
      });
    }

    registration.checkInAt = new Date();
    await registration.save();

    return res.json({
      success: true,
      message: 'Check-in thành công.',
      data: registration,
    });
  } catch (error) {
    console.error('Shift check-in error:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể check-in lúc này.',
    });
  }
};

const checkOut = async (req, res) => {
  try {
    const staffId = req.user?.id;
    const { shiftId } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(shiftId)) {
      return res.status(400).json({
        success: false,
        message: 'shiftId không hợp lệ.',
      });
    }

    const registration = await ShiftRegistration.findOne({ shiftId, staffId });
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đăng ký ca làm.',
      });
    }

    if (registration.status !== SHIFT_REGISTRATION_STATUS.APPROVED) {
      return res.status(403).json({
        success: false,
        message: 'Bạn chưa được duyệt ca này nên không thể check-out.',
      });
    }

    const shift = await Shift.findById(registration.shiftId);
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy ca làm.',
      });
    }

    if (shift.status === SHIFT_STATUS.CLOSED) {
      return res.status(400).json({
        success: false,
        message: 'Ca làm đã đóng, không thể check-out.',
      });
    }

    if (!registration.checkInAt) {
      return res.status(400).json({
        success: false,
        message: 'Bạn chưa check-in nên không thể check-out.',
      });
    }

    if (registration.checkOutAt) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã check-out ca này rồi.',
      });
    }

    registration.checkOutAt = new Date();
    await registration.save();

    const workingHours = (registration.checkOutAt.getTime() - registration.checkInAt.getTime()) / (1000 * 60 * 60);

    return res.json({
      success: true,
      message: 'Check-out thành công.',
      data: {
        registration,
        workingHours,
      },
    });
  } catch (error) {
    console.error('Shift check-out error:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể check-out lúc này.',
    });
  }
};

const undoCheckout = async (req, res) => {
  try {
    const staffId = req.user?.id;
    const { shiftId } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(shiftId)) {
      return res.status(400).json({
        success: false,
        message: 'shiftId không hợp lệ.',
      });
    }

    const registration = await ShiftRegistration.findOne({ shiftId, staffId });
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đăng ký ca làm.',
      });
    }

    if (registration.status !== SHIFT_REGISTRATION_STATUS.APPROVED) {
      return res.status(403).json({
        success: false,
        message: 'Bạn chưa được duyệt ca này nên không thể hoàn tác check-out.',
      });
    }

    if (!registration.checkInAt) {
      return res.status(400).json({
        success: false,
        message: 'Bạn chưa check-in nên không thể hoàn tác check-out.',
      });
    }

    if (!registration.checkOutAt) {
      return res.status(400).json({
        success: false,
        message: 'Bạn chưa thực hiện check-out.',
      });
    }

    const shift = await Shift.findById(registration.shiftId);
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy ca làm.',
      });
    }

    if (shift.status === SHIFT_STATUS.CLOSED) {
      return res.status(400).json({
        success: false,
        message: 'Ca làm đã đóng, không thể hoàn tác.',
      });
    }

    registration.checkOutAt = null;
    await registration.save();

    return res.json({
      success: true,
      message: 'Hoàn tác check-out thành công. Bạn có thể tiếp tục ca làm.',
      data: registration,
    });
  } catch (error) {
    console.error('Undo shift check-out error:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể hoàn tác check-out lúc này.',
    });
  }
};

const getShiftRegistrations = async (req, res) => {
  try {
    const shiftId = String(req.params?.shiftId || '').trim();

    if (!mongoose.Types.ObjectId.isValid(shiftId)) {
      return res.status(400).json({
        success: false,
        message: 'shiftId không hợp lệ.',
      });
    }

    const shift = await Shift.findById(shiftId);
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy ca làm.',
      });
    }

    const items = await ShiftRegistration.find({ shiftId })
      .populate('staffId', 'name email phone role')
      .sort({ createdAt: 1 });

    return res.json({
      success: true,
      message: 'Lấy danh sách đăng ký ca làm thành công.',
      data: {
        shiftId,
        items,
      },
    });
  } catch (error) {
    console.error('Get shift registrations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể lấy danh sách đăng ký lúc này.',
    });
  }
};

const getMyShiftRegistrations = async (req, res) => {
  try {
    const staffId = req.user?.id;
    const dateValue = String(req.query?.date || '').trim();

    const filter = { staffId };

    if (dateValue) {
      const shiftDate = normalizeShiftDate(dateValue);
      if (!shiftDate) {
        return res.status(400).json({
          success: false,
          message: 'date không hợp lệ (ví dụ: 2026-04-23).',
        });
      }

      const { start, end } = getDayRange(shiftDate);
      const shiftIds = await Shift.find({ date: { $gte: start, $lt: end } }).distinct('_id');
      filter.shiftId = { $in: shiftIds };
    }

    const items = await ShiftRegistration.find(filter)
      .populate('shiftId', 'date startTime endTime status requiredStaff')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      message: 'Lấy đăng ký ca làm thành công.',
      data: {
        items,
      },
    });
  } catch (error) {
    console.error('Get my shift registrations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể lấy đăng ký ca làm lúc này.',
    });
  }
};

const closeShift = async (req, res) => {
  try {
    const shiftId = String(req.params?.shiftId || '').trim();

    if (!mongoose.Types.ObjectId.isValid(shiftId)) {
      return res.status(400).json({
        success: false,
        message: 'shiftId không hợp lệ.',
      });
    }

    let resultShift;
    let session;
    try {
      session = await mongoose.startSession();
      await session.withTransaction(async () => {
        const shift = await Shift.findById(shiftId).session(session);
        if (!shift) {
          const e = new Error('Không tìm thấy ca làm.');
          e.httpCode = 404;
          throw e;
        }

        if (shift.status !== SHIFT_STATUS.CLOSED) {
          shift.status = SHIFT_STATUS.CLOSED;
          await shift.save({ session });
        }

        // Idempotent: dù ca đã đóng từ trước vẫn ghi nhận check-out cho nhân viên đã check-in nhưng chưa check-out
        await ShiftRegistration.updateMany(
          {
            shiftId: shift._id,
            status: SHIFT_REGISTRATION_STATUS.APPROVED,
            checkInAt: { $ne: null },
            checkOutAt: null,
          },
          { $set: { checkOutAt: new Date() } },
          { session }
        );

        resultShift = shift;
      });
    } catch (error) {
      const message = String(error?.message || '');
      const isTxnUnsupported = message.includes('Transaction') || message.includes('replica set') || message.includes('mongos');
      if (!isTxnUnsupported) {
        const httpCode = Number(error?.httpCode || 0);
        if (httpCode) {
          return res.status(httpCode).json({ success: false, message: error.message });
        }
        throw error;
      }

      // Fallback cho MongoDB standalone
      const shift = await Shift.findById(shiftId);
      if (!shift) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy ca làm.' });
      }

      if (shift.status !== SHIFT_STATUS.CLOSED) {
        shift.status = SHIFT_STATUS.CLOSED;
        await shift.save();
      }

      await ShiftRegistration.updateMany(
        {
          shiftId: shift._id,
          status: SHIFT_REGISTRATION_STATUS.APPROVED,
          checkInAt: { $ne: null },
          checkOutAt: null,
        },
        { $set: { checkOutAt: new Date() } }
      );

      resultShift = shift;
    } finally {
      if (session) session.endSession();
    }

    return res.json({
      success: true,
      message: 'Đóng ca thành công.',
      data: resultShift,
    });
  } catch (error) {
    console.error('Close shift error:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể đóng ca lúc này.',
    });
  }
};
const getCurrentShift = async (req, res) => {
  try {
    const staffId = req.user?.id;
    if (!staffId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const active = await getActiveShiftForStaff(staffId);
    if (!active?.shift || !active?.registration) {
      return res.json({
        success: true,
        message: 'Không có ca hiện tại.',
        data: null,
      });
    }

    const safeShift = sanitizeShiftForStaff(active.shift);
    const registrationPlain = typeof active.registration.toObject === 'function'
      ? active.registration.toObject()
      : { ...active.registration };
    registrationPlain.shiftId = active.shift?._id || registrationPlain.shiftId;

    return res.json({
      success: true,
      message: 'Lấy ca hiện tại thành công.',
      data: {
        shift: safeShift,
        registration: registrationPlain,
      },
    });
  } catch (error) {
    console.error('Get current shift error:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể lấy ca hiện tại lúc này.',
    });
  }
};

const updateShift = async (req, res) => {
  try {
    const shiftId = String(req.params?.id || '').trim();
    const { requiredStaff } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(shiftId)) {
      return res.status(400).json({
        success: false,
        message: 'id không hợp lệ.',
      });
    }

    const nextRequiredStaff = Number(requiredStaff);
    if (!Number.isInteger(nextRequiredStaff) || nextRequiredStaff < 1) {
      return res.status(400).json({
        success: false,
        message: 'Số lượng nhân sự phải là số nguyên và > 0.',
      });
    }

    let resultShift;
    let session;
    try {
      session = await mongoose.startSession();
      await session.withTransaction(async () => {
        const shift = await Shift.findById(shiftId).session(session);
        if (!shift) {
          const e = new Error('Không tìm thấy ca làm.');
          e.httpCode = 404;
          throw e;
        }

        if (shift.status === SHIFT_STATUS.CLOSED) {
          const e = new Error('Ca làm đã đóng, không thể cập nhật số nhân sự.');
          e.httpCode = 400;
          throw e;
        }

        const shiftStartAt = buildDateTimeFromShift(shift.date, shift.startTime);
        if (shiftStartAt && Date.now() >= shiftStartAt.getTime()) {
          const e = new Error('Ca làm đã bắt đầu, không thể cập nhật số nhân sự.');
          e.httpCode = 400;
          throw e;
        }

        const assignedCount = Array.isArray(shift.assignedStaffIds) ? shift.assignedStaffIds.length : 0;
        if (nextRequiredStaff < assignedCount) {
          const e = new Error(`Không thể giảm số nhân sự xuống dưới ${assignedCount} (đã đăng ký/đã duyệt).`);
          e.httpCode = 400;
          throw e;
        }

        if (nextRequiredStaff > SHIFT_MAX_REQUIRED_STAFF) {
          const e = new Error(`Số lượng nhân sự tối đa cho một ca là ${SHIFT_MAX_REQUIRED_STAFF}.`);
          e.httpCode = 400;
          throw e;
        }

        shift.requiredStaff = nextRequiredStaff;
        const nextStatus = recomputeShiftStatus(shift);
        shift.status = nextStatus;
        await shift.save({ session });
        resultShift = shift;
      });
    } catch (error) {
      const message = String(error?.message || '');
      const isTxnUnsupported = message.includes('Transaction') || message.includes('replica set') || message.includes('mongos');
      if (!isTxnUnsupported) {
        const httpCode = Number(error?.httpCode || 0);
        if (httpCode) {
          return res.status(httpCode).json({ success: false, message: error.message });
        }
        throw error;
      }

      // Fallback cho MongoDB standalone
      const shift = await Shift.findById(shiftId);
      if (!shift) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy ca làm.' });
      }
      if (shift.status === SHIFT_STATUS.CLOSED) {
        return res.status(400).json({ success: false, message: 'Ca làm đã đóng, không thể cập nhật số nhân sự.' });
      }
      const shiftStartAt = buildDateTimeFromShift(shift.date, shift.startTime);
      if (shiftStartAt && Date.now() >= shiftStartAt.getTime()) {
        return res.status(400).json({ success: false, message: 'Ca làm đã bắt đầu, không thể cập nhật số nhân sự.' });
      }
      const assignedCount = Array.isArray(shift.assignedStaffIds) ? shift.assignedStaffIds.length : 0;
      if (nextRequiredStaff < assignedCount) {
        return res.status(400).json({ success: false, message: `Không thể giảm số nhân sự xuống dưới ${assignedCount} (đã đăng ký/đã duyệt).` });
      }
      if (nextRequiredStaff > SHIFT_MAX_REQUIRED_STAFF) {
        return res.status(400).json({ success: false, message: `Số lượng nhân sự tối đa cho một ca là ${SHIFT_MAX_REQUIRED_STAFF}.` });
      }

      shift.requiredStaff = nextRequiredStaff;
      shift.status = recomputeShiftStatus(shift);
      await shift.save();
      resultShift = shift;
    } finally {
      if (session) session.endSession();
    }

    return res.json({
      success: true,
      message: 'Cập nhật số nhân sự cho ca làm thành công.',
      data: resultShift,
    });
  } catch (error) {
    console.error('Update shift error:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể cập nhật ca làm lúc này.',
    });
  }
};

module.exports = {
  createShift,
  getShifts,
  registerShift,
  approveShiftRegistration,
  checkIn,
  checkOut,
  undoCheckout,
  getShiftRegistrations,
  getMyShiftRegistrations,
  closeShift,
  getCurrentShift,
  updateShift,
};
