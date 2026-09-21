import { Suspense } from 'react';
import LoginPage from './login-form';

export default function LoginRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
        </div>
      }
    >
      <LoginPage />
    </Suspense>
  );
}
