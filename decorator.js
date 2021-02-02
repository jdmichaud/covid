(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('coordinates'), require('@jdmichaud/observable')) :
  typeof define === 'function' && define.amd ? define(['exports', 'coordinates', '@jdmichaud/observable'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Decorators = {}, global.coordinates, global.Observable));
}(this, (function (exports, coordinates, observable) { 'use strict';

  /**
   * Calls a callback whenever the mouse is moved while being clicked.
   */
  class ClickController {
      constructor(clickInput, callback) {
          this.clickInput = clickInput;
          this.callback = callback;
          this.enable();
      }
      enable() {
          this.disable();
          this.unsubscription = this.clickInput.subscribe({
              click: this.callback,
          });
      }
      disable() {
          if (this.unsubscription !== undefined) {
              this.unsubscription();
          }
      }
  }

  /* TODO: Pass the viewport coordinate system */
  function getEventPosition(event) {
      // getBoundingClientRect is slow
      const rect = event.target.getBoundingClientRect();
      return coordinates.V4(event.clientX - rect.left, event.clientY - rect.top, 0, 1);
  }
  // export function getEventPositionA(event: MouseEvent | Touch, position: { x: number; y: number }): void {
  //   // getBoundingClientRect is slow
  //   const rect = (event.target as any).getBoundingClientRect();
  //   position.x = event.clientX - rect.left;
  //   position.y = event.clientY - rect.top;
  // }

  /**
   * Changes the (style.) left and top value depending on the drag input.
   * Element must be positioned absolutely.
   */
  class ElementDragController {
      constructor(element, view) {
          this.element = element;
          this.view = view;
          this.enable();
      }
      enable() {
          // Avoid multiple subscription by disabling first.
          this.disable();
          let startPosition;
          this.unsubscription = this.view.subscribe({
              down: events => startPosition = getEventPosition(events[0]),
              move: events => {
                  const movePosition = getEventPosition(events[0]);
                  this.element.style.left = `${this.element.offsetLeft + movePosition.x - startPosition.x}px`;
                  this.element.style.top = `${this.element.offsetTop + movePosition.y - startPosition.y}px`;
              },
              up: _ => { },
          });
      }
      disable() {
          if (this.unsubscription !== undefined) {
              this.unsubscription();
          }
      }
  }

  /**
   * Return a default implementation for subscribe. Typescript does not provide
   * a clean mixin implementation, requiring the use of strange construction in
   * order to mix base implementation. The blocker being that Typescript does not
   * allow partial template inference, thus things like: https://stackoverflow.com/a/55601197/2603925
   * is not possible if the implementation class requires a type parameter:
   *
   * class Foo<U> extends Bar<U>(Bazz()) implements IBar, IBazz {...
   *                         ^^^
   *                          fails here because missing T specifier.
   */
  function BaseSubscribable(clients) {
      return (mediator) => {
          // push the mediator into the list of subscribed clients...
          const index = clients.push(mediator) - 1;
          // ... and return a function which allows to remove that client from the list.
          return () => clients.splice(index, 1);
      };
  }

  /**
   * A partially implemented Input interface.
   * See the documentation for BaseSubscribable for more details on why class mixins
   * are not practical in that situation.
   */
  class Input {
      constructor() {
          this.clients = [];
          this.subscribe = BaseSubscribable(this.clients);
      }
  }
  (function (MouseButton) {
      MouseButton[MouseButton["LEFT"] = 0] = "LEFT";
      MouseButton[MouseButton["MIDDLE"] = 1] = "MIDDLE";
      MouseButton[MouseButton["RIGHT"] = 2] = "RIGHT";
      MouseButton[MouseButton["BACK"] = 3] = "BACK";
      MouseButton[MouseButton["FORWARD"] = 4] = "FORWARD";
  })(exports.MouseButton || (exports.MouseButton = {}));

  class MouseClickInput extends Input {
      constructor(element, button = exports.MouseButton.LEFT) {
          super();
          this.element = element;
          this.button = button;
          this.mousedown = (event) => {
              if (event.button === this.button) {
                  this.clients.forEach(c => {
                      if (c.down !== undefined) {
                          c.down(event);
                      }
                  });
              }
          };
          this.mouseup = (event) => {
              if (event.button === this.button) {
                  this.clients.forEach(c => {
                      if (c.up !== undefined) {
                          c.up(event);
                      }
                  });
              }
          };
          this.click = (event) => {
              if (event.button === this.button) {
                  this.clients.forEach(c => c.click(event));
              }
          };
          this.enable();
      }
      enable() {
          this.disable();
          this.element.addEventListener('mousedown', this.mousedown);
          this.element.addEventListener('mouseup', this.mouseup);
          this.element.addEventListener('click', this.click);
      }
      disable() {
          this.element.removeEventListener('mousedown', this.mousedown);
          this.element.removeEventListener('mouseup', this.mouseup);
          this.element.removeEventListener('click', this.click);
      }
  }

  /**
   * Calls the DragMediator when the mouse is moved while clicked on a specified
   * element.
   */
  class MouseDragInput extends Input {
      constructor(element, button = exports.MouseButton.LEFT) {
          super();
          this.element = element;
          this.button = button;
          this.mousedown = (event) => {
              if (event.button === this.button) {
                  document.addEventListener('mousemove', this.mousemove);
                  document.addEventListener('mouseup', this.mouseup);
                  this.clients.forEach(c => c.down([event]));
              }
          };
          this.mousemove = (event) => {
              this.clients.forEach(c => c.move([event]));
          };
          this.mouseup = (event) => {
              document.removeEventListener('mousemove', this.mousemove);
              document.removeEventListener('mouseup', this.mouseup);
              this.clients.forEach(c => c.up([event]));
          };
          this.enable();
      }
      enable() {
          this.disable();
          this.element.addEventListener('mousedown', this.mousedown);
      }
      disable() {
          this.element.removeEventListener('mousedown', this.mousedown);
      }
  }

  /**
   * A partially implemented View interface.
   * See the documentation for BaseSubscribable for more details on why class mixins
   * are not practical in that situation.
   */
  class View {
      constructor() {
          this.clients = [];
          this.subscribe = BaseSubscribable(this.clients);
      }
  }
  /**
   * Act as a pass through.
   */
  class PassThroughView extends View {
      constructor(input) {
          super();
          this.input = input;
          // Pass-through. Nothing gets done here.
          this.subscribe = (mediator) => {
              this.unsubscription = this.input.subscribe(mediator);
              return this.unsubscription;
          };
          this.enable();
      }
      enable() {
          this.disable();
      }
      disable() {
          if (this.unsubscription !== undefined) {
              this.unsubscription();
          }
      }
  }

  class PanController {
      constructor(model, view) {
          this.model = model;
          this.view = view;
          this.enable();
      }
      enable() {
          this.disable();
          let start;
          let previous;
          this.unsubscription = this.view.subscribe({
              down: events => { start = events[0]; previous = events[0]; },
              move: events => {
                  const current = events[0];
                  this.model.apply(camera => {
                      const previousPosition = getEventPosition(previous);
                      const currentPosition = getEventPosition(current);
                      currentPosition.subA(previousPosition.x, previousPosition.y, previousPosition.z);
                      camera.eye.addA(currentPosition.x, currentPosition.y, currentPosition.z);
                      camera.look.addA(currentPosition.x, currentPosition.y, currentPosition.z);
                  });
                  previous = current;
              },
              up: event => { },
          });
      }
      disable() {
          if (this.unsubscription !== undefined) {
              this.unsubscription();
          }
      }
  }
  class PanDecorator {
      constructor(controller) {
          this.controller = controller;
      }
      static create(element, model) {
          return new PanDecorator(new PanController(model, new PassThroughView(new MouseDragInput(element, exports.MouseButton.LEFT))));
      }
      enable() { this.controller.disable(); }
      disable() { this.controller.enable(); }
  }

  class Model extends observable.Subject {
      constructor(underlying) {
          super();
          this.underlying = underlying;
      }
      get() { return this.underlying; }
  }
  // export class AggregateModel<T> extends Model<T> {
  //   constructor(underlying: T, observables: Array<Observable<any>>) {
  //     super(underlying);
  //     observables.forEach(observable => observable.subscribe(_ => this.next(this.underlying)));
  //   }
  // }
  class MutableModel extends Model {
      constructor(underlying) {
          super(underlying);
      }
      apply(changeFunction) {
          changeFunction(this.underlying);
          this.next(this.underlying);
      }
      touch() {
          this.next(this.underlying);
      }
  }
  /**
   * Converts a subject to another subject which object extracted from the original object.
   * Useful to limit function parameters to the requested model
   * ex.:
   * function foo(lookModel: Model<Vector>) { lookModel.subscribe(look => ...); }
   * foo(watch(cameraModel, (camera) => camera.look));
   * Here foo is not expecting the full Camera, only a vector.
   */
  function focus(model, extractor) {
      const subModel = new Model(extractor(model.get()));
      model.subscribe(underlying => {
          subModel.next(extractor(underlying));
      });
      return subModel;
  }
  /**
   * Converts a array of subject to a subject of array.
   */
  function watchAll(models) {
      const watchModel = new Model(models.map(m => m.get()));
      models.forEach(m => m.subscribe(u => watchModel.next(models.map(m => m.get()))));
      return watchModel;
  }

  /**
   */
  class TouchDragInput extends Input {
      constructor(element, nbFingers = 1) {
          super();
          this.element = element;
          this.nbFingers = nbFingers;
          this.touchstart = (event) => {
              if (event.touches.length == this.nbFingers) {
                  document.addEventListener('touchmove', this.touchmove);
                  document.addEventListener('touchend', this.touchend);
                  this.clients.forEach(c => c.down(Array.from(event.touches)));
              }
          };
          this.touchmove = (event) => {
              this.clients.forEach(c => c.move(Array.from(event.touches)));
          };
          this.touchend = (event) => {
              document.removeEventListener('touchmove', this.touchmove);
              document.removeEventListener('touchend', this.touchend);
              this.clients.forEach(c => c.up(Array.from(event.touches)));
          };
          this.enable();
      }
      enable() {
          this.disable();
          this.element.addEventListener('touchstart', this.touchstart);
      }
      disable() {
          this.element.removeEventListener('touchmove', this.touchstart);
      }
  }

  /**
   * Calls the DragMediator when the mouse is moved while clicked on a specified
   * element.
   */
  class MouseWheelInput extends Input {
      constructor(element) {
          super();
          this.element = element;
          this.wheel = (event) => {
              this.clients.forEach(c => c.delta(event));
          };
          this.enable();
      }
      enable() {
          this.disable();
          this.element.addEventListener('wheel', this.wheel);
      }
      disable() {
          this.element.removeEventListener('wheel', this.wheel);
      }
  }

  function zoomCamera(camera, center, deltaY) {
      return camera;
  }
  class ZoomController {
      constructor(model, center, view) {
          this.model = model;
          this.center = center;
          this.view = view;
          this.enable();
      }
      enable() {
          this.disable();
          this.unsubscription = this.view.subscribe({
              delta: event => {
                  this.model.apply(camera => {
                      const newCamera = zoomCamera(camera, this.center.get(), event.deltaY);
                      camera.look = newCamera.look;
                      camera.eye = newCamera.eye;
                      camera.fov = newCamera.fov;
                  });
              },
          });
      }
      disable() {
          if (this.unsubscription !== undefined) {
              this.unsubscription();
          }
      }
  }
  class ZoomFocusController {
      constructor(model, view) {
          this.model = model;
          this.view = view;
          this.enable();
      }
      enable() {
          this.disable();
          this.unsubscription = this.view.subscribe({
              delta: event => {
                  this.model.apply(camera => {
                      const center = getEventPosition(event);
                      const newCamera = zoomCamera(camera, center, event.deltaY);
                      camera.look = newCamera.look;
                      camera.eye = newCamera.eye;
                      camera.fov = newCamera.fov;
                  });
              },
          });
      }
      disable() {
          if (this.unsubscription !== undefined) {
              this.unsubscription();
          }
      }
  }
  class ZoomDecorator {
      constructor(controller) {
          this.controller = controller;
      }
      static create(element, model) {
          return new ZoomDecorator(new ZoomFocusController(model, new PassThroughView(new MouseWheelInput(element))));
      }
      enable() { this.controller.disable(); }
      disable() { this.controller.enable(); }
  }

  exports.ClickController = ClickController;
  exports.ElementDragController = ElementDragController;
  exports.MouseClickInput = MouseClickInput;
  exports.MouseDragInput = MouseDragInput;
  exports.MouseWheelInput = MouseWheelInput;
  exports.MutableModel = MutableModel;
  exports.PanController = PanController;
  exports.PanDecorator = PanDecorator;
  exports.PassThroughView = PassThroughView;
  exports.TouchDragInput = TouchDragInput;
  exports.ZoomController = ZoomController;
  exports.ZoomDecorator = ZoomDecorator;
  exports.ZoomFocusController = ZoomFocusController;
  exports.focus = focus;
  exports.watchAll = watchAll;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=decorator.js.map
