import dynamic from "next/dynamic";
const BookingsClient = dynamic(() => import("./BookingsClient"), { ssr: false });

export default function Page() {
  return <BookingsClient />;
} 