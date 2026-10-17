"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        print();
      }}
      className="min-h-12 rounded-full bg-espresso px-6 font-medium text-on-espresso"
    >
      {label}
    </button>
  );
}
