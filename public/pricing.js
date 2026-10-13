(() => {
  const script = document.currentScript;
  const origin = new URL(script.src).origin;
  if (customElements.get('smart-pricing')) return;
  customElements.define(
    'smart-pricing',
    class extends HTMLElement {
      connectedCallback() {
        if (this.querySelector('iframe')) this.replaceChildren();
        const project = this.getAttribute('project');
        if (!project) {
          this.textContent = 'A pricing project ID is required.';
          return;
        }
        const frame = document.createElement('iframe');
        const source = new URL(`/embed/${encodeURIComponent(project)}`, origin);
        source.searchParams.set('parentOrigin', location.origin);
        frame.src = source.href;
        frame.title = 'Build your package';
        frame.style.cssText = 'width:100%;height:850px;border:0;border-radius:20px;display:block;';
        frame.loading = 'lazy';
        this.append(frame);
        this.listener = (event) => {
          if (
            event.origin !== origin ||
            event.source !== frame.contentWindow ||
            event.data?.type !== 'smart-pricing:configuration'
          )
            return;
          this.dispatchEvent(
            new CustomEvent('configuration', { detail: event.data, bubbles: true }),
          );
        };
        window.addEventListener('message', this.listener);
      }
      disconnectedCallback() {
        if (this.listener) window.removeEventListener('message', this.listener);
      }
    },
  );
})();
