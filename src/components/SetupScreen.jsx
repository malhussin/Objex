'use client';

import { useRouter } from 'next/navigation';

import ConnectionForm from './ConnectionForm';
import Icon from './Icon';

/** First-run screen: the app is running but not pointed at a bucket yet. */
export default function SetupScreen({ status }) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col bg-gcp-canvas">
      <header className="flex h-12 items-center gap-3 bg-gcp-blue px-4 text-white">
        <Icon name="folder_shared" size={22} />
        <span className="text-[20px] font-medium leading-none">Objex</span>
      </header>

      <main className="flex flex-1 items-start justify-center p-4 sm:p-8">
        <div className="w-full max-w-[640px] rounded-lg border border-gcp-border bg-white p-6 shadow-gcp-1 sm:p-8">
          <h1 className="text-gcp-xl font-normal text-gcp-text">Connect Objex to a bucket</h1>
          <p className="mt-2 text-gcp-md text-gcp-secondary">
            Add a service account key and choose the bucket you want to manage. Nothing needs to be
            set up before starting the container — you can change this later from the settings menu.
          </p>

          <div className="mt-6 border-t border-gcp-divider pt-6">
            <ConnectionForm
              status={status}
              variant="page"
              onSaved={() => router.refresh()}
            />
          </div>

          <div className="mt-6 rounded border border-gcp-border bg-gcp-canvas p-3 text-gcp-base text-gcp-secondary">
            <p className="flex items-start gap-2">
              <Icon name="info" size={18} className="mt-0.5 shrink-0 text-gcp-secondary" />
              <span>
                The service account needs <span className="font-mono">roles/storage.objectAdmin</span>{' '}
                on the bucket to upload and delete. Anyone who can reach this page can change the
                connection unless <span className="font-mono">OBJEX_ADMIN_TOKEN</span> is set.
              </span>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
