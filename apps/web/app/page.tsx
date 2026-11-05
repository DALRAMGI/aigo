import { Footer } from "@/components/ui/Footer";
import { Nav } from "@/components/ui/Nav";

// 랜딩은 Task 14에서 채운다.
export default function Home() {
  return (
    <>
      <Nav />
      <main className="frame min-h-[60vh]" />
      <Footer />
    </>
  );
}
