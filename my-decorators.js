// Convert event data to point in svg coordinate system
// from: https://stackoverflow.com/questions/55564432/how-do-i-translate-mouse-movement-distances-to-svg-coordinate-space
function getEventPosition(svg, event) {
  var toSvgMatrix = svg.getScreenCTM().inverse();
  var pt = svg.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  return pt.matrixTransform(toSvgMatrix);
}

function PanDecorator(svg, model) {
  const view = new Decorators.PassThroughView(
    new Decorators.MouseDragInput(svg, Decorators.MouseButton.LEFT)
  );

  const controller = {
    enable: () => {
      controller.disable();
      let startMousePosition;
      // This is the movement speed, to be continued if mouse release in movement.
      let delta;
      let upTimeout;
      controller.unsubscription = view.subscribe({
        down: events => {
          startMousePosition = getEventPosition(svg, events[0]);
        },
        move: events => {
          const current = getEventPosition(svg, events[0]);
          delta = {
            x: startMousePosition.x - current.x,
            y: startMousePosition.y - current.y,
          };
          model.apply(viewBox => {
            viewBox.x += delta.x;
            viewBox.y += delta.y;
          });
          // If we keep the mouse button long enough without moving then we don't
          // want to continue the movement.
          if (upTimeout !== undefined) {
            clearTimeout(upTimeout);
          }
          upTimeout = setTimeout(() => {
            delta.x = 0;
            delta.y = 0;
          }, 10);
        },
        up: event => {
          if (upTimeout !== undefined) {
            // We release the mouse button while moving to cancel the delta reset
            clearTimeout(upTimeout);
          }
          // We will now apply an easing deceleration
          // from: https://gist.github.com/gre/1650294
          const easing = t => t<.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1;
          const delay = 1000; // in ms
          const startTimestamp = Date.now();
          const interval = setInterval(() => {
            const elapsed = Date.now() - startTimestamp;
            if (elapsed >= delay) {
              clearInterval(interval);
            } else {
              const easingFactor = easing((delay - elapsed) / delay);
              const x = delta.x * easingFactor;
              const y = delta.y * easingFactor;
              model.apply(viewBox => {
                viewBox.x += x;
                viewBox.y += y;
              });
            }
          }, 30);
        },
      });
    },
    disable: () => {
      if (controller.unsubscription !== undefined) {
        controller.unsubscription();
      }
    },
  };

  return {
    view,
    controller,
    enable: () => (controller.enable(), this),
    disable: () => (controller.disable(), this),
  };
}

function ZoomDecorator(svg, model) {
  const view = new Decorators.PassThroughView(
    new Decorators.MouseWheelInput(svg)
  );

  const controller = {
    enable: () => {
      controller.unsubscription = view.subscribe({
        delta: event => {
          model.apply(viewBox => {
            const delta = Math.sign(event.deltaY) * event.deltaY / event.deltaY * 20;
            viewBox.x -= delta / 2;
            viewBox.y -= delta / 2;
            viewBox.width += delta;
            viewBox.height += delta;
          });
        },
      });
    },
    disable: () => {
      if (controller.unsubscription !== undefined) {
        controller.unsubscription();
      }
    },
  };

  return {
    view,
    controller,
    enable: () => (controller.enable(), this),
    disable: () => (controller.disable(), this),
  };
}