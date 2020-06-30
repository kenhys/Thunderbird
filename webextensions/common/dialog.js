/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

export const TYPE_READY = 'dialog-ready';

function generateId() {
  return `${Date.now()}-${Math.round(Math.random() * 65000)}`;
}


const DEFAULT_WIDTH_OFFSET  = 30; /* left window frame + right window frame + scrollbar (for failsafe) */
const DEFAULT_HEIGHT_OFFSET = 40; /* top title bar + bottom window frame */
let lastWidthOffset  = null;
let lastHeightOffset = null;

export async function open(url) {
  const id = generateId();

  const extraParams = `dialog-id=${id}&dialog-offscreen=true`;
  if (url.includes('?'))
    url = url.replace(/\?/, `?${extraParams}&`);
  if (url.includes('#'))
    url = url.replace(/#/, `?${extraParams}#`);
  else
    url = `${url}?${extraParams}`;

  // step 1: render dialog in a hidden iframe to determine its content size
  const dialogContentSize = await new Promise((resolve, _reject) => {
    const loader = document.body.appendChild(document.createElement('iframe'));
    loader.addEventListener('load',
      async () => {
        loader.contentDocument.documentElement.classList.add('offscreen');
        const [readyEvent, ] = await Promise.all([
          new Promise(resolveReady => loader.contentDocument.addEventListener(TYPE_READY, resolveReady, { once: true })),
          new Promise(resolveNextTick => setTimeout(resolveNextTick, 0))
        ]);
        const dialogContent = loader.contentDocument.querySelector('.dialog-content') || loader.contentDocument.body;
        const rect = dialogContent.getBoundingClientRect();
        resolve({
          ...readyEvent.detail,
          width:  rect.width,
          height: rect.height
        });
        loader.parentNode.removeChild(loader);
      },
      {
        once:    true,
        capture: true
      }
    );
    loader.src = url;
  });

  const widthOffset  = lastWidthOffset === null ? DEFAULT_WIDTH_OFFSET : lastWidthOffset;
  const heightOffset = lastHeightOffset === null ? DEFAULT_HEIGHT_OFFSET : lastHeightOffset;

  const win = new Promise(async (resolve, _reject) => {
    // step 2: open real dialog window
    const promisedWin = browser.windows.create({
      type:   'popup',
      url:    url.replace(/(dialog-offscreen)=true/, '$1=false'),
      width:  Math.ceil(dialogContentSize.width + widthOffset),
      height: Math.ceil(dialogContentSize.height + heightOffset),
      allowScriptsToClose: true
    });
    const onReady = async (message, sender) => {
      if (!message || message.type != TYPE_READY || message.id != id)
        return;

      browser.runtime.onMessage.removeListener(onReady);

      const win = await promisedWin;

      // step 3: shrink or expand the dialog window if the offset is changed
      lastWidthOffset  = message.windowWidthOffset;
      lastHeightOffset = message.windowHeightOffset;
      if (lastWidthOffset != widthOffset ||
          lastHeightOffset != heightOffset) {
        browser.windows.update(win.id, {
          width:  Math.ceil(dialogContentSize.width + lastWidthOffset),
          height: Math.ceil(dialogContentSize.height + lastHeightOffset)
        });
      }

      resolve(win);
    };
    browser.runtime.onMessage.addListener(onReady);
  });

  return win;
}


// this must be called in the dialog itself
export function notifyReady() {
  const params = new URLSearchParams(location.search);
  const id = params.get('dialog-id');

  const detail = {
    id,
    windowWidthOffset:  Math.max(0, window.outerWidth - window.innerWidth),
    windowHeightOffset: Math.max(0, window.outerHeight - window.innerHeight)
  };
  const event = new CustomEvent(TYPE_READY, {
    detail,
    bubbles:    true,
    cancelable: false,
    composed:   true
  });
  document.dispatchEvent(event);

  if (params.get('dialog-offscreen') != 'true')
    browser.runtime.sendMessage({
      type: TYPE_READY,
      ...detail
    });
}
