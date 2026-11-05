import { CtaBand } from "@/components/landing/CtaBand";
import { Hero } from "@/components/landing/Hero";
import { Principles } from "@/components/landing/Principles";
import { Process } from "@/components/landing/Process";
import { Products } from "@/components/landing/Products";
import { ReportSample } from "@/components/landing/ReportSample";
import "@/components/landing/landing.css";
import { Footer } from "@/components/ui/Footer";
import { Nav } from "@/components/ui/Nav";

export default function Home() {
  return (
    <div data-surface="landing">
      <Nav />
      <main className="frame">
        <Hero />
        <Process />
        <ReportSample />
        <Products />
        <Principles />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}
