import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, CheckCircle2, Clock3, Play, ShieldCheck, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";

const purchasingModels = [
  {
    title: "Labor Only (Supply Your Own Materials)",
    description:
      "Hire verified crews while you source materials independently. Perfect for owners who already have suppliers and want transparent labor tracking.",
    cta: "Compare Labor Teams",
  },
  {
    title: "Milestone Payments (Deposit and Progress Payments)",
    description:
      "Release funds by approved milestones. AI progress checks and engineer sign-off ensure each stage is complete before payment.",
    cta: "View Payment Structure",
  },
  {
    title: "Managed Build (Engineering Oversight Included)",
    description:
      "End-to-end managed delivery with engineering oversight, quality checks, and centralized reporting for sponsors and property owners.",
    cta: "Request Managed Build",
  },
];

const timelineMilestones = [
  { phase: "Foundation", status: "Completed", date: "May 15" },
  { phase: "Structural Walls", status: "On Track", date: "Jun 28" },
  { phase: "Roofing", status: "In Review", date: "Jul 19" },
  { phase: "Finishing", status: "Scheduled", date: "Aug 12" },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div>
            <p className="text-lg font-bold text-blue-700">BuildLiberia Connect</p>
            <p className="text-xs text-slate-500">Construction transparency portal</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>Dashboard</Button>
            <Button onClick={() => navigate("/auth")}>Get Started</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl space-y-10 px-4 py-10 md:py-14">
        <section className="space-y-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Professional SaaS Visualization</p>
          <h1 className="text-3xl font-bold md:text-5xl">Build smarter, verify faster, and fund with confidence.</h1>
          <p className="mx-auto max-w-3xl text-slate-600 md:text-lg">
            A unified workflow for contractors, engineers, buyers, and sponsors to monitor live progress, process worker uploads,
            and make transparent construction decisions across Liberia.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button className="gap-2 bg-blue-700 hover:bg-blue-800">
              Launch Portal <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-50">
              Schedule Demo
            </Button>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
            <p className="mb-3 text-sm font-semibold text-slate-700">Desktop Monitor View</p>
            <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-100 p-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <p className="mb-2 text-sm font-medium text-slate-700">Site Worker POV (Meta Quest 3 View)</p>
                <div className="relative aspect-video rounded-lg bg-gradient-to-br from-blue-700 via-blue-600 to-green-500 p-4 text-white">
                  <div className="absolute right-3 top-3 rounded-full bg-black/30 px-2 py-1 text-xs">LIVE REVIEW</div>
                  <div className="flex h-full items-center justify-center">
                    <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur">
                      <Play className="h-4 w-4" /> Watch Construction Footage
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-blue-100 bg-white p-3">
                <p className="text-sm font-semibold text-blue-700">AI Progress Dashboard</p>
                <p className="mt-2 text-xs text-slate-600">
                  Automated summary: 92% construction accuracy. Rebar spacing and plaster alignment meet approved standards.
                </p>
                <div className="mt-3 space-y-2 text-xs">
                  {timelineMilestones.map((item) => (
                    <div key={item.phase} className="flex items-center justify-between rounded border border-slate-200 px-2 py-1">
                      <span className="font-medium">{item.phase}</span>
                      <span className="text-slate-500">{item.status} • {item.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl border-green-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-700">Mobile View</p>
            <div className="mt-3 rounded-2xl border-4 border-slate-900 bg-slate-100 p-3">
              <p className="text-xs font-semibold text-blue-700">On-Site Status</p>
              <p className="mt-2 text-sm font-medium">Blockwork Completed</p>
              <p className="text-xs text-slate-500">AI verified 14:20 GMT</p>
              <div className="mt-3 rounded-lg bg-white p-2 text-xs">
                <p className="font-medium">Next Action</p>
                <p className="text-slate-600">Upload roof beam inspection clip</p>
              </div>
              <Button size="sm" className="mt-3 w-full gap-2 bg-green-600 hover:bg-green-700">
                <Upload className="h-3.5 w-3.5" /> Upload Proof
              </Button>
            </div>
          </Card>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-slate-700">Tablet Inset View</p>
            <p className="text-sm font-medium text-blue-700">Worker Upload + AI Video Processing</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between rounded border border-slate-200 px-3 py-2">
                <span>Upload</span>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex items-center justify-between rounded border border-blue-200 bg-blue-50 px-3 py-2">
                <span>AI Video Processing</span>
                <Clock3 className="h-4 w-4 text-blue-700" />
              </div>
              <div className="h-2 rounded bg-slate-200">
                <div className="h-full w-3/4 rounded bg-blue-600" />
              </div>
              <p className="text-xs text-slate-500">Frame analysis, material recognition, and timeline tagging in progress.</p>
            </div>
          </Card>

          <Card className="rounded-2xl border-blue-200 bg-blue-50/60 p-5 shadow-sm">
            <p className="text-sm font-semibold text-blue-800">Dedicated Professional Banner Ad Spaces</p>
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border border-blue-200 bg-white p-3">
                <p className="text-sm font-semibold">Sponsor: Liberia Commerce Bank</p>
                <p className="text-xs text-slate-600">Construction loans with milestone-based disbursement for verified projects.</p>
              </div>
              <div className="rounded-lg border border-green-200 bg-white p-3">
                <p className="text-sm font-semibold">Sponsor: Monrovia Hardware Supply</p>
                <p className="text-xs text-slate-600">Bulk cement, steel, and roofing inventory for BuildLiberia Connect projects.</p>
              </div>
            </div>
          </Card>
        </section>

        <section className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-bold">Choose Your Purchasing Model</h2>
            <ShieldCheck className="h-6 w-6 text-green-600" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {purchasingModels.map((model) => (
              <Card key={model.title} className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">{model.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{model.description}</p>
                <Button variant="outline" className="mt-4 w-full border-blue-200 text-blue-700 hover:bg-blue-50">
                  {model.cta}
                </Button>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Find a Licensed Engineer</h3>
            <p className="mt-2 text-sm text-slate-600">
              Search verified civil and structural professionals by county, specialty, and availability.
            </p>
            <Button className="mt-4 bg-blue-700 hover:bg-blue-800">Browse Engineer Directory</Button>
          </Card>

          <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Construction Material Marketplace</h3>
            <p className="mt-2 text-sm text-slate-600">
              Compare pricing, quality certifications, and logistics options from trusted Liberian suppliers.
            </p>
            <Button className="mt-4 bg-green-600 hover:bg-green-700">Open Material Marketplace</Button>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default Index;
