import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <main class="doc-page">
      <a routerLink="/" class="doc-page__back">← DashDash home</a>
      <h1>Contact DashDash</h1>
      <p>
        We are a small, independent team and we read every message. Whether you
        have found a bug, want a site added to the catalog, need help with
        billing, or just want to say hello — get in touch.
      </p>

      <h2>Email us</h2>
      <ul>
        <li>
          General &amp; feedback:
          <a href="mailto:hello&#64;dashdash.app">hello&#64;dashdash.app</a>
        </li>
        <li>
          Support &amp; billing:
          <a href="mailto:support&#64;dashdash.app">support&#64;dashdash.app</a>
        </li>
        <li>
          Privacy &amp; data requests:
          <a href="mailto:privacy&#64;dashdash.app">privacy&#64;dashdash.app</a>
        </li>
      </ul>

      <h2>Response times</h2>
      <p>
        We aim to reply within two business days. For account-specific
        questions, please email us from the address on your DashDash account so
        we can verify you quickly. Premium billing issues are prioritised.
      </p>

      <h2>Company</h2>
      <p>
        DashDash is an independent product. Postal and press enquiries can be
        sent to the general address above and we will route them to the right
        person.
      </p>
    </main>
  `,
})
export class ContactComponent {
  constructor() {
    inject(SeoService).set({
      title: 'Contact',
      description: 'How to reach the DashDash team for support, billing, feedback, and privacy requests.',
      path: '/contact',
    });
  }
}
