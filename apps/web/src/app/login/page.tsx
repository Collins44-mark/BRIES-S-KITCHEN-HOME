import { Suspense } from 'react';
import LoginPage from './login-form';
import styles from './login.module.css';

export default function LoginRoute() {
  return (
    <Suspense
      fallback={
        <div className={styles.page}>
          <div className={styles.bg} aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/login-bg.jpg"
              alt=""
              className={styles.bgImage}
              decoding="async"
            />
            <div className={styles.bgOverlay} />
          </div>
          <div className={styles.bootCenter}>
            <div className={styles.bootSpinner} aria-hidden />
            <span className={styles.visuallyHidden}>Loading</span>
          </div>
        </div>
      }
    >
      <LoginPage />
    </Suspense>
  );
}
