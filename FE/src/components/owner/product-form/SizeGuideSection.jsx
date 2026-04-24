import { useState } from 'react'
import { getSizeGuideRowsByGender, SIZE_GUIDE_GENDERS, toText } from './formUtils'

const GENDER_LABELS = {
    male: 'Nam',
    female: 'Nữ',
}

const toCellValue = (value) => {
    if (value === undefined || value === null) return ''
    return String(value)
}

const HEADERS = [
    { key: 'sizeLabel', label: 'Size' },
    { key: 'height', label: 'Chiều cao (cm)' },
    { key: 'weight', label: 'Cân nặng (kg)' },
    { key: 'itemLength', label: 'Dài áo (cm)' },
    { key: 'itemWidth', label: 'Rộng (cm)' },
    { key: 'actions', label: 'Thao tác' },
]

export default function SizeGuideSection({
    mode = 'global',
    rows = [],
    onModeChange,
    onUpdateCell,
    sizeLabelDraftByGender = { male: '', female: '' },
    onSizeLabelDraftChange,
    onAddSizeLabel,
    onDeleteSizeLabel,
    onReorderRows,
    errors = {},
}) {
    const isProductMode = mode === 'product'
    const [dragState, setDragState] = useState({ gender: '', fromIndex: -1, overIndex: -1 })

    const startDrag = (gender, index) => {
        setDragState({ gender, fromIndex: index, overIndex: index })
    }

    const dragOver = (event, gender, index) => {
        event.preventDefault()
        setDragState((prev) => {
            if (prev.gender !== gender) return prev
            if (prev.overIndex === index) return prev
            return { ...prev, overIndex: index }
        })
    }

    const dropRow = (event, gender, index) => {
        event.preventDefault()
        setDragState((prev) => {
            if (prev.gender !== gender || prev.fromIndex < 0) return { gender: '', fromIndex: -1, overIndex: -1 }
            onReorderRows?.(gender, prev.fromIndex, index)
            return { gender: '', fromIndex: -1, overIndex: -1 }
        })
    }

    const endDrag = () => {
        setDragState({ gender: '', fromIndex: -1, overIndex: -1 })
    }

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <div className="space-y-2">
                <h4 className="text-sm font-bold text-slate-900">Bảng tư vấn size</h4>
                <div className="flex flex-wrap gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                            type="radio"
                            name="size-guide-mode"
                            checked={!isProductMode}
                            onChange={() => onModeChange?.('global')}
                        />
                        Dùng bảng size mặc định
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                            type="radio"
                            name="size-guide-mode"
                            checked={isProductMode}
                            onChange={() => onModeChange?.('product')}
                        />
                        Dùng bảng size riêng cho sản phẩm này
                    </label>
                </div>
            </div>

            {isProductMode ? (
                <div className="space-y-4">
                    {SIZE_GUIDE_GENDERS.map((gender) => {
                        const genderRows = getSizeGuideRowsByGender(rows, gender)

                        return (
                            <div key={gender} className="space-y-2">
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                                    <p className="text-sm font-semibold text-slate-800">{GENDER_LABELS[gender]} - thêm size</p>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <input
                                            type="text"
                                            maxLength={20}
                                            className="h-9 w-full max-w-[220px] border border-slate-200 rounded-lg px-2 text-sm"
                                            placeholder="Ví dụ: XXL"
                                            value={toText(sizeLabelDraftByGender?.[gender])}
                                            onChange={(event) => onSizeLabelDraftChange?.(gender, event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    event.preventDefault()
                                                    onAddSizeLabel?.(gender)
                                                }
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="h-9 px-3 rounded-lg border border-slate-200 text-sm font-medium"
                                            onClick={() => onAddSizeLabel?.(gender)}
                                        >
                                            Thêm size cho {GENDER_LABELS[gender]}
                                        </button>
                                    </div>
                                </div>

                                <div className="overflow-x-auto rounded-lg border border-slate-200">
                                    <table className="w-full text-left border-collapse min-w-[900px]">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                {HEADERS.map((header) => (
                                                    <th key={header.key} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                        {header.label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {genderRows.map((row, index) => (
                                                <tr
                                                    key={`${row.gender}-${row.sizeLabel}`}
                                                    className={`border-t border-slate-100 ${dragState.gender === gender && dragState.overIndex === index ? 'bg-sky-50' : ''}`}
                                                    draggable
                                                    onDragStart={() => startDrag(gender, index)}
                                                    onDragOver={(event) => dragOver(event, gender, index)}
                                                    onDrop={(event) => dropRow(event, gender, index)}
                                                    onDragEnd={endDrag}
                                                >
                                                    <td className="px-3 py-2 text-sm font-semibold text-slate-700">
                                                        {row.sizeLabel}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <RangeInput
                                                            minValue={toCellValue(row.heightMin)}
                                                            maxValue={toCellValue(row.heightMax)}
                                                            onChangeMin={(value) => onUpdateCell?.(gender, row.sizeLabel, 'heightMin', value)}
                                                            onChangeMax={(value) => onUpdateCell?.(gender, row.sizeLabel, 'heightMax', value)}
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <RangeInput
                                                            minValue={toCellValue(row.weightMin)}
                                                            maxValue={toCellValue(row.weightMax)}
                                                            onChangeMin={(value) => onUpdateCell?.(gender, row.sizeLabel, 'weightMin', value)}
                                                            onChangeMax={(value) => onUpdateCell?.(gender, row.sizeLabel, 'weightMax', value)}
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            className="w-full h-9 border border-slate-200 rounded-lg px-2 text-sm"
                                                            value={toCellValue(row.itemLength)}
                                                            onChange={(event) => onUpdateCell?.(gender, row.sizeLabel, 'itemLength', event.target.value)}
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            className="w-full h-9 border border-slate-200 rounded-lg px-2 text-sm"
                                                            value={toCellValue(row.itemWidth)}
                                                            onChange={(event) => onUpdateCell?.(gender, row.sizeLabel, 'itemWidth', event.target.value)}
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="h-8 w-8 rounded border border-slate-200 text-slate-500 flex items-center justify-center cursor-grab" title="Kéo để sắp xếp">
                                                                ↕
                                                            </span>
                                                            <button
                                                                type="button"
                                                                className="h-8 px-2 rounded border border-rose-200 text-rose-600 text-xs font-medium"
                                                                onClick={() => onDeleteSizeLabel?.(gender, row.sizeLabel)}
                                                            >
                                                                Xóa
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )
                    })}
                    {errors.sizeGuideRows ? <p className="text-xs text-rose-600">{errors.sizeGuideRows}</p> : null}
                </div>
            ) : (
                <p className="text-sm text-slate-500">Sản phẩm sẽ dùng bảng size mặc định của hệ thống.</p>
            )}
        </section>
    )
}

function RangeInput({ minValue, maxValue, onChangeMin, onChangeMax }) {
    return (
        <div className="flex items-center gap-2">
            <input
                type="number"
                min="0"
                className="w-full h-9 border border-slate-200 rounded-lg px-2 text-sm"
                value={toText(minValue)}
                onChange={(event) => onChangeMin?.(event.target.value)}
            />
            <span className="text-slate-400">-</span>
            <input
                type="number"
                min="0"
                className="w-full h-9 border border-slate-200 rounded-lg px-2 text-sm"
                value={toText(maxValue)}
                onChange={(event) => onChangeMax?.(event.target.value)}
            />
        </div>
    )
}
