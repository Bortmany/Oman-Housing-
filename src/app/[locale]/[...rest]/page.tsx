import { notFound } from "next/navigation";

// Any address that matches no real page ends here, so the not-found screen
// renders inside the locale layout (and in the visitor's language).
export default function CatchAll() {
  notFound();
}
