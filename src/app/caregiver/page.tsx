import Link from "next/link";
import { CaregiverPanel } from "@/components/CaregiverPanel";

export default function CaregiverPage() {
  return (
    <main className="relative">
      <CaregiverPanel />
      <Link href="/" className="absolute right-4 top-4 text-xs text-neutral-400 underline hover:text-neutral-600">
        Back to conversation
      </Link>
    </main>
  );
}
