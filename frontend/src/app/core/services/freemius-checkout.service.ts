import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

const SCRIPT_SRC = 'https://checkout.freemius.com/js/v1/';

/**
 * Loads the Freemius checkout script on demand and opens the overlay.
 * The email is locked (readonly_user) so the webhook can match the buyer
 * to the account by email.
 */
@Injectable({ providedIn: 'root' })
export class FreemiusCheckoutService {
  private scriptPromise: Promise<void> | null = null;

  async open(userEmail: string, onSuccess: () => void): Promise<void> {
    await this.loadScript();
    const FS = (window as any).FS;
    const checkout = new FS.Checkout({
      product_id: environment.freemius.productId,
      plan_id: environment.freemius.planId,
      public_key: environment.freemius.publicKey,
    });
    checkout.open({
      user_email: userEmail,
      readonly_user: true,
      success: () => onSuccess(),
    });
  }

  private loadScript(): Promise<void> {
    if ((window as any).FS?.Checkout) {
      return Promise.resolve();
    }
    if (!this.scriptPromise) {
      this.scriptPromise = new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = SCRIPT_SRC;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => {
          script.remove();
          this.scriptPromise = null;
          reject(new Error('freemius checkout script failed to load'));
        };
        document.head.appendChild(script);
      });
    }
    return this.scriptPromise;
  }
}
