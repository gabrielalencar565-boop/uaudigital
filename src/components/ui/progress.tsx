import { GradientBar } from "@/components/ui/gradient-bar";

// The app's standard progress bar: brand gradient ending in a round thumb.
function Progress({ value, className }: { value?: number | null; className?: string }) {
  return <GradientBar value={value ?? 0} size="sm" className={className} />;
}

export { Progress };
