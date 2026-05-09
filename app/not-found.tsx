import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container section text-center" style={{ paddingTop: 80 }}>
      <div style={{ fontSize: "3rem", color: "var(--nura-gold)" }}>✦</div>
      <h1>Page not found</h1>
      <p className="text-mute">That shade isn&apos;t in our edit.</p>
      <Link href="/" className="btn btn-primary" style={{ marginTop: 12 }}>Back to home</Link>
    </div>
  );
}
