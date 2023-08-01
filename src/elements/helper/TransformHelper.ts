import { IPoint } from "../../interfaces/IPoint.js";
import { IDesignerCanvas } from "../widgets/designerView/IDesignerCanvas.js";
import { getElementsWindowOffsetWithoutSelfAndParentTransformations, getParentElementIncludingSlots } from "./ElementHelper.js";

let identityMatrix: number[] = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1
];

export function getElementCombinedTransform(element: HTMLElement): DOMMatrix {
  //https://www.w3.org/TR/css-transforms-2/#ctm
  let s = getComputedStyle(element);

  let m = new DOMMatrix();
  if (s.translate != 'none') {
    m = m.multiply(new DOMMatrix('translate(' + s.translate + ')'));
  }
  if (s.rotate != 'none') {
    m = m.multiply(new DOMMatrix('rotate(' + s.rotate + ')'));
  }
  if (s.scale != 'none') {
    m = m.multiply(new DOMMatrix('scale(' + s.rotate + ')'));
  }
  if (s.transform != 'none') {
    m = m.multiply(new DOMMatrix(s.transform));
  }
  return m;
}

export function combineTransforms(element: HTMLElement, actualTransforms: string, requestedTransformation: string) {
  if (actualTransforms == null || actualTransforms == '') {
    element.style.transform = requestedTransformation;
    return;
  }

  const actualTransformationMatrix = new DOMMatrix(actualTransforms);
  const requestedTransformationMatrix = new DOMMatrix(requestedTransformation);
  const newTransformationMatrix = requestedTransformationMatrix.multiply(actualTransformationMatrix);
  element.style.transform = newTransformationMatrix.toString();
}

export function getDomMatrix(element: HTMLElement) {
  return new DOMMatrix(window.getComputedStyle(element).transform);
}

export function transformPointByInverseMatrix(point: DOMPoint, matrix: DOMMatrix) {
  const inverse = matrix.inverse();
  //fix chrome bug: https://bugs.chromium.org/p/chromium/issues/detail?id=1395645
  inverse.m33 = 1;
  inverse.m44 = 1;
  return point.matrixTransform(inverse);
}

export function getRotationMatrix3d(axisOfRotation: 'x' | 'y' | 'z' | 'X' | 'Y' | 'Z', angle: number) {
  const angleInRadians = angle / 180 * Math.PI;
  const sin = Math.sin;
  const cos = Math.cos;
  let rotationMatrix3d = [];

  switch (axisOfRotation.toLowerCase()) {
    case 'x':
      rotationMatrix3d = [
        1, 0, 0, 0,
        0, cos(angleInRadians), -sin(angleInRadians), 0,
        0, sin(angleInRadians), cos(angleInRadians), 0,
        0, 0, 0, 1
      ];
      break;
    case 'y':
      rotationMatrix3d = [
        cos(angleInRadians), 0, sin(angleInRadians), 0,
        0, 1, 0, 0,
        -sin(angleInRadians), 0, cos(angleInRadians), 0,
        0, 0, 0, 1
      ];
      break;
    case 'z':
      rotationMatrix3d = [
        cos(angleInRadians), -sin(angleInRadians), 0, 0,
        sin(angleInRadians), cos(angleInRadians), 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ];
      break;
    default:
      rotationMatrix3d = null;
      break;
  }

  return rotationMatrix3d;
}

export function rotateElementByMatrix3d(element: HTMLElement, matrix: number[]) {
  element.style.transform = matrixArrayToCssMatrix(matrix);
}

export function matrixArrayToCssMatrix(matrixArray: number[]) {
  return "matrix3d(" + matrixArray.join(',') + ")";
}

export function cssMatrixToMatrixArray(cssMatrix: string) {
  if (!cssMatrix.includes('matrix')) {
    if (cssMatrix != 'none')
      console.error('cssMatrixToMatrixArray: no css matrix passed');
    return identityMatrix;
  }
  let matrixArray: number[] = cssMatrix.match(/^matrix.*\((.*)\)/)[1].split(',').map(Number);
  return matrixArray;
}

export function getRotationAngleFromMatrix(matrixArray: number[], domMatrix: DOMMatrix) {
  let angle = null;
  const a = domMatrix != null ? domMatrix.a : matrixArray[0];
  const b = domMatrix != null ? domMatrix.b : matrixArray[1];
  angle = Math.round(Math.atan2(b, a) * (180 / Math.PI));

  return angle;
}

export function addVectors(vectorA: [number, number], vectorB: [number, number]): [number, number] {
  return [vectorA[0] + vectorB[0], vectorA[1] + vectorB[1]];
}

export function getDesignerCanvasNormalizedTransformedOriginWithoutParentTransformation(element: HTMLElement, designerCanvas: IDesignerCanvas): DOMPoint {
  const top0: DOMPointReadOnly = new DOMPointReadOnly(
    -parseFloat(getComputedStyle(<HTMLElement>element).transformOrigin.split(' ')[0]),
    -parseFloat(getComputedStyle(<HTMLElement>element).transformOrigin.split(' ')[1]),
    0,
    0
  )

  const p0Offsets = getElementsWindowOffsetWithoutSelfAndParentTransformations(element, designerCanvas.zoomFactor);

  const transformOriginAbsolutRelatedToWindowWithoutAnyTransformation = new DOMPoint(p0Offsets.offsetLeft - top0.x, p0Offsets.offsetTop - top0.y);
  const designerCanvasNormalizedTransformedOrigin = new DOMPoint(transformOriginAbsolutRelatedToWindowWithoutAnyTransformation.x - designerCanvas.containerBoundingRect.x, transformOriginAbsolutRelatedToWindowWithoutAnyTransformation.y - designerCanvas.containerBoundingRect.y);

  return designerCanvasNormalizedTransformedOrigin;
}

export function getResultingTransformationBetweenElementAndAllAncestors(element: HTMLElement, ancestor: HTMLElement, excludeAncestor?: boolean) {
  let actualElement: HTMLElement = element;
  let actualElementMatrix: DOMMatrix;
  let newElementMatrix: DOMMatrix;
  let originalElementAndAllParentsMultipliedMatrix: DOMMatrix;
  while (actualElement != ancestor) {
    const newElement = <HTMLElement>getParentElementIncludingSlots(actualElement);
    actualElementMatrix = new DOMMatrix(getComputedStyle((<HTMLElement>actualElement)).transform);
    newElementMatrix = new DOMMatrix(getComputedStyle((<HTMLElement>newElement)).transform);
    newElementMatrix.m41 = newElementMatrix.m42 = 0;
    if (actualElement == element) {
      originalElementAndAllParentsMultipliedMatrix = actualElementMatrix.multiply(newElementMatrix);
    } else if (newElement != ancestor || !excludeAncestor) {
      originalElementAndAllParentsMultipliedMatrix = originalElementAndAllParentsMultipliedMatrix.multiply(newElementMatrix);
    }

    actualElement = newElement;
  }

  return originalElementAndAllParentsMultipliedMatrix;
}

export function getByParentsTransformedPointRelatedToCanvas(element: HTMLElement, point: DOMPoint, designerCanvas: IDesignerCanvas) {
  const canvas = element.closest('#node-projects-designer-canvas-canvas');
  let actualElement: HTMLElement = element;
  let parentElementTransformOriginToPointVectorTransformed: DOMPointReadOnly;
  let byParentTransformedPointRelatedToCanvas: IPoint = { x: 0, y: 0 };
  while (actualElement != canvas) {
    const parentElement = <HTMLElement>getParentElementIncludingSlots(actualElement);
    const parentElementTransformOrigin: DOMPoint = new DOMPoint(
      getElementsWindowOffsetWithoutSelfAndParentTransformations(parentElement, designerCanvas.zoomFactor).offsetLeft - designerCanvas.outerRect.x + parseFloat(getComputedStyle(<HTMLElement>parentElement).transformOrigin.split(' ')[0]),
      getElementsWindowOffsetWithoutSelfAndParentTransformations(parentElement, designerCanvas.zoomFactor).offsetTop - designerCanvas.outerRect.y + parseFloat(getComputedStyle(<HTMLElement>parentElement).transformOrigin.split(' ')[1]),
    )
    if (actualElement == element) {
      parentElementTransformOrigin.x -= extractTranslationFromDOMMatrix(new DOMMatrix(element.style.transform)).x;
      parentElementTransformOrigin.y -= extractTranslationFromDOMMatrix(new DOMMatrix(element.style.transform)).y;
    }

    const parentElementTransformOriginToPointVector: DOMPointReadOnly = new DOMPointReadOnly(
      -parentElementTransformOrigin.x + (element == actualElement ? point.x : byParentTransformedPointRelatedToCanvas.x),
      -parentElementTransformOrigin.y + (element == actualElement ? point.y : byParentTransformedPointRelatedToCanvas.y)
    )

    parentElementTransformOriginToPointVectorTransformed = parentElementTransformOriginToPointVector.matrixTransform(new DOMMatrix(getComputedStyle((<HTMLElement>parentElement)).transform));
    byParentTransformedPointRelatedToCanvas = new DOMPoint(parentElementTransformOrigin.x + parentElementTransformOriginToPointVectorTransformed.x, parentElementTransformOrigin.y + parentElementTransformOriginToPointVectorTransformed.y);
    actualElement = parentElement;
  }

  return byParentTransformedPointRelatedToCanvas;
}

export function getDesignerCanvasNormalizedTransformedPoint(element: HTMLElement, point: IPoint, designerCanvas: IDesignerCanvas): IPoint {
  return getDesignerCanvasNormalizedTransformedCornerDOMPoints(element, { x: -point.x, y: -point.y }, designerCanvas)[0];
}

export function getElementSize(element: HTMLElement) {
  let width = element.offsetWidth;
  let height = element.offsetHeight;
  if (element instanceof SVGElement && (<any>element).width) {
    width = (<SVGAnimatedLength>(<any>element).width).baseVal.value
    height = (<SVGAnimatedLength>(<any>element).height).baseVal.value
  } else if (element instanceof SVGGraphicsElement) {
    let bbox = element.getBBox()
    width = bbox.width;
    height = bbox.height;
  }
  return { width, height }
}

export function getDesignerCanvasNormalizedTransformedCornerDOMPoints(element: HTMLElement, untransformedCornerPointsOffset: IPoint | null, designerCanvas: IDesignerCanvas): [DOMPoint, DOMPoint, DOMPoint, DOMPoint] {
  const topleft = 0;
  const topright = 1;
  const bottomleft = 2;
  const bottomright = 3;
  const intUntransformedCornerPointsOffset = untransformedCornerPointsOffset ? { x: untransformedCornerPointsOffset.x / designerCanvas.scaleFactor, y: untransformedCornerPointsOffset.y / designerCanvas.scaleFactor } : { x: 0, y: 0 };

  const p0Offsets = getElementsWindowOffsetWithoutSelfAndParentTransformations(element, designerCanvas.zoomFactor);
  const p0OffsetsRelatedToCanvas = DOMPoint.fromPoint(
    {
      x: p0Offsets.offsetLeft - designerCanvas.containerBoundingRect.left,
      y: p0Offsets.offsetTop - designerCanvas.containerBoundingRect.top
    }
  )

  let { width, height } = getElementSize(element);

  const elementWithoutTransformCornerDOMPoints: DOMPoint[] = [];
  elementWithoutTransformCornerDOMPoints[topleft] = DOMPoint.fromPoint(
    {
      x: p0OffsetsRelatedToCanvas.x - intUntransformedCornerPointsOffset.x,
      y: p0OffsetsRelatedToCanvas.y - intUntransformedCornerPointsOffset.y
    }
  )
  elementWithoutTransformCornerDOMPoints[topright] = DOMPoint.fromPoint(
    {
      x: p0OffsetsRelatedToCanvas.x + width + intUntransformedCornerPointsOffset.x,
      y: p0OffsetsRelatedToCanvas.y - intUntransformedCornerPointsOffset.y
    }
  )
  elementWithoutTransformCornerDOMPoints[bottomleft] = DOMPoint.fromPoint(
    {
      x: p0OffsetsRelatedToCanvas.x - intUntransformedCornerPointsOffset.x,
      y: p0OffsetsRelatedToCanvas.y + height + intUntransformedCornerPointsOffset.y
    }
  )
  elementWithoutTransformCornerDOMPoints[bottomright] = DOMPoint.fromPoint(
    {
      x: p0OffsetsRelatedToCanvas.x + width + intUntransformedCornerPointsOffset.x,
      y: p0OffsetsRelatedToCanvas.y + height + intUntransformedCornerPointsOffset.y
    }
  )

  const transformOriginWithoutTransformRelatedToCanvas: DOMPointReadOnly = DOMPointReadOnly.fromPoint(
    {
      x: p0OffsetsRelatedToCanvas.x + parseFloat(getComputedStyle(<HTMLElement>element).transformOrigin.split(' ')[0]),
      y: p0OffsetsRelatedToCanvas.y + parseFloat(getComputedStyle(<HTMLElement>element).transformOrigin.split(' ')[1]),
      z: 0,
      w: 0
    }
  )

  const designerCanvasNormalizedTransformOrigin = getByParentsTransformedPointRelatedToCanvas(element, new DOMPoint(getElementsWindowOffsetWithoutSelfAndParentTransformations(element, designerCanvas.zoomFactor).offsetLeft - designerCanvas.outerRect.left + parseFloat(getComputedStyle(<HTMLElement>element).transformOrigin.split(' ')[0]), getElementsWindowOffsetWithoutSelfAndParentTransformations(element, designerCanvas.zoomFactor).offsetTop - designerCanvas.outerRect.top + parseFloat(getComputedStyle(<HTMLElement>element).transformOrigin.split(' ')[1])), designerCanvas);

  let top0 = new DOMPoint(-(transformOriginWithoutTransformRelatedToCanvas.x - elementWithoutTransformCornerDOMPoints[topleft].x), -(transformOriginWithoutTransformRelatedToCanvas.y - elementWithoutTransformCornerDOMPoints[topleft].y));
  let top1 = new DOMPoint(-(transformOriginWithoutTransformRelatedToCanvas.x - elementWithoutTransformCornerDOMPoints[topright].x), -(transformOriginWithoutTransformRelatedToCanvas.y - elementWithoutTransformCornerDOMPoints[topright].y));
  let top2 = new DOMPoint(-(transformOriginWithoutTransformRelatedToCanvas.x - elementWithoutTransformCornerDOMPoints[bottomleft].x), -(transformOriginWithoutTransformRelatedToCanvas.y - elementWithoutTransformCornerDOMPoints[bottomleft].y));
  let top3 = new DOMPoint(-(transformOriginWithoutTransformRelatedToCanvas.x - elementWithoutTransformCornerDOMPoints[bottomright].x), -(transformOriginWithoutTransformRelatedToCanvas.y - elementWithoutTransformCornerDOMPoints[bottomright].y));

  let originalElementAndAllParentsMultipliedMatrix: DOMMatrix = getResultingTransformationBetweenElementAndAllAncestors(element, <HTMLElement>designerCanvas.canvas, true);

  let top0Transformed = top0.matrixTransform(originalElementAndAllParentsMultipliedMatrix);
  let top1Transformed = top1.matrixTransform(originalElementAndAllParentsMultipliedMatrix);
  let top2Transformed = top2.matrixTransform(originalElementAndAllParentsMultipliedMatrix);
  let top3Transformed = top3.matrixTransform(originalElementAndAllParentsMultipliedMatrix);

  let transformedCornerPoints: [DOMPoint, DOMPoint, DOMPoint, DOMPoint] = <any>[];
  transformedCornerPoints[0] = new DOMPoint(designerCanvasNormalizedTransformOrigin.x + top0Transformed.x, designerCanvasNormalizedTransformOrigin.y + top0Transformed.y);
  transformedCornerPoints[1] = new DOMPoint(designerCanvasNormalizedTransformOrigin.x + top1Transformed.x, designerCanvasNormalizedTransformOrigin.y + top1Transformed.y);
  transformedCornerPoints[2] = new DOMPoint(designerCanvasNormalizedTransformOrigin.x + top2Transformed.x, designerCanvasNormalizedTransformOrigin.y + top2Transformed.y);
  transformedCornerPoints[3] = new DOMPoint(designerCanvasNormalizedTransformOrigin.x + top3Transformed.x, designerCanvasNormalizedTransformOrigin.y + top3Transformed.y);

  return transformedCornerPoints;
}

export function extractTranslationFromDOMMatrix(matrix: DOMMatrix): DOMPoint {
  return new DOMPoint(matrix.m41, matrix.m42, 0, 0);
}

export function extractRotationAngleFromDOMMatrix(matrix: DOMMatrix): number {
  return getRotationAngleFromMatrix(null, matrix);
}

export function normalizeToAbsolutePosition(element: HTMLElement, normalizeProperty: "left" | "top") {
  switch (normalizeProperty) {
    case "left":
      let left = getComputedStyle(element).left;
      (<HTMLElement>element).style.removeProperty('right');
      (<HTMLElement>element).style.left = left;
      return left;
    case "top":
      let top = getComputedStyle(element).top;
      (<HTMLElement>element).style.removeProperty('bottom');
      (<HTMLElement>element).style.top = top;
      return top;
  }
  return null;

}