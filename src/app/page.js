import { getPublicStatus } from '@/lib/config';
import ObjexBrowser from '@/components/ObjexBrowser';
import SetupScreen from '@/components/SetupScreen';

// The connection is read per-request, so the same image serves the setup screen
// and the browser without a rebuild or restart.
export const dynamic = 'force-dynamic';

export default async function Page() {
  const status = await getPublicStatus();

  if (!status.configured) return <SetupScreen status={status} />;

  return <ObjexBrowser status={status} />;
}
