// Render separately so export includes the entire diagram, independent of zoom
// and scroll position, and also works from the source editor.
export async function exportPng(source, container, filename, render) {
  const document = container.ownerDocument;
  const window = document.defaultView;
  const staging = document.createElement('div');
  staging.className = 'alice-mmd-staging';
  container.appendChild(staging);
  let link;
  try {
    const result = await render(source, staging, document.body.classList.contains('theme-dark'));
    staging.innerHTML = result.svg;
    // Mermaid wraps sandbox output in a base64 HTML iframe. Extract its SVG
    // without executing callbacks or changing the source's security settings.
    const iframe = staging.querySelector('iframe');
    if (iframe) {
      const encoded = iframe.getAttribute('src').split(',')[1];
      const bytes = Uint8Array.from(window.atob(encoded), character => character.charCodeAt(0));
      const sandbox = new window.DOMParser().parseFromString(new TextDecoder().decode(bytes), 'text/html');
      const graphic = sandbox.querySelector('svg');
      if (graphic) staging.replaceChildren(document.importNode(graphic, true));
    }
    const svg = staging.querySelector('svg');
    if (!svg) throw new Error('No SVG diagram to export.');
    // Keep it measurable and styled, but outside the visible document.
    staging.style.left = '-100000px';
    staging.style.visibility = 'visible';
    await document.fonts?.ready;
    const bounds = svg.viewBox.baseVal;
    const rect = svg.getBoundingClientRect();
    const width = Math.ceil(bounds.width || rect.width);
    const height = Math.ceil(bounds.height || rect.height);
    if (width <= 0 || height <= 0) throw new Error('The diagram has no image dimensions.');
    const copy = svg.cloneNode(true);
    const originals = [svg, ...svg.querySelectorAll('*')];
    const copies = [copy, ...copy.querySelectorAll('*')];
    for (let index = 0; index < originals.length; index++) {
      const style = window.getComputedStyle(originals[index]);
      for (const property of style) {
        // Computed marker/fill URLs may be absolute; the exported SVG needs
        // references within its own document.
        const value = style.getPropertyValue(property).replace(/url\(["']?[^)"']*#([^)'"\s]+)["']?\)/g, 'url(#$1)');
        copies[index].style.setProperty(property, value);
      }
    }
    copy.querySelectorAll('style').forEach(style => style.remove());
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    copy.setAttribute('width', String(width));
    copy.setAttribute('height', String(height));
    Object.assign(copy.style, { width: `${width}px`, height: `${height}px`, maxWidth: 'none' });
    const image = new window.Image();
    const loaded = new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Unable to load the diagram image.'));
    });
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new window.XMLSerializer().serializeToString(copy))}`;
    await loaded;
    const canvas = document.createElement('canvas');
    canvas.width = width * 2;
    canvas.height = height * 2;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to create a PNG canvas.');
    context.fillStyle = window.getComputedStyle(container).getPropertyValue('--background-primary').trim()
      || (document.body.classList.contains('theme-dark') ? '#1e1e1e' : '#ffffff');
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
  } finally {
    link?.remove();
    staging.remove();
  }
}
