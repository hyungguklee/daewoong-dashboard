import { useRef, useState } from 'react';

export default function FileUpload({ onFile, isLoading }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  const handle = (file) => {
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      alert('Excel 파일(.xlsx, .xls)을 업로드해주세요.');
      return;
    }
    onFile(file);
  };

  return (
    <div
      className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
        dragging ? 'border-[var(--accent)] bg-blue-50' : 'border-[var(--line)] hover:border-[var(--accent)]'
      }`}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]); }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={e => handle(e.target.files[0])}
      />
      <div className="text-3xl mb-3">📊</div>
      {isLoading ? (
        <div className="text-sm text-[var(--ink-3)]">파일 처리 중...</div>
      ) : (
        <>
          <div className="text-sm font-medium text-[var(--ink-2)] mb-1">
            엑셀 파일을 드래그하거나 클릭하여 업로드
          </div>
          <div className="text-xs text-[var(--ink-4)]">
            .xlsx · .xls 지원 · 매달 새 파일 업로드 시 누적 저장
          </div>
        </>
      )}
    </div>
  );
}
