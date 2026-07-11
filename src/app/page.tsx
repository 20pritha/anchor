import Link from "next/link";
import { ConversationView } from "@/components/ConversationView";

export default function HomePage() {
  return (
    <main className="relative">
      <ConversationView />
      <Link
        href="/caregiver"
        className="absolute right-4 top-4 text-xs text-neutral-400 underline hover:text-neutral-600"
      >
        Caregiver panel
      </Link>
    </main>
  );
}
