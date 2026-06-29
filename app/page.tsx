import { WorkspaceProvider } from "@/components/WorkspaceProvider";
import { EmiApp } from "@/components/EmiApp";

export default function Page() {
  return (
    <WorkspaceProvider>
      <EmiApp />
    </WorkspaceProvider>
  );
}
