/**
 * PATCH-SECP-044 — Vector Drawing Exporter (SVG & DXF Engine)
 * Generates layered vector files with preserved scales, ISO/ASME line weights, stroke-dash patterns, and dimensions.
 */

import { DrawingSheet, DrawingStandardType } from './DrawingTypes';
import { DrawingStandardEngine } from './DrawingStandard';

export class DrawingExporter {
  /**
   * Exports a technical drawing sheet to clean, fully vectorized SVG without any rasterization.
   */
  public static exportToSVG(sheet: DrawingSheet): string {
    const width = sheet.widthMm;
    const height = sheet.heightMm;

    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}mm" height="${height}mm">
  <defs>
    <style>
      .sheet-bg { fill: #ffffff; }
      .border-line { stroke: #0f172a; stroke-width: 0.7; fill: none; }
      .visible-edge { stroke: #0f172a; stroke-width: 0.5; fill: none; stroke-linecap: round; }
      .hidden-edge { stroke: #64748b; stroke-width: 0.25; stroke-dasharray: 4, 2; fill: none; }
      .center-line { stroke: #0284c7; stroke-width: 0.25; stroke-dasharray: 10, 2, 2, 2; fill: none; }
      .hatch-line { stroke: #475569; stroke-width: 0.25; fill: none; }
      .dimension-line { stroke: #0f172a; stroke-width: 0.25; fill: none; }
      .extension-line { stroke: #0f172a; stroke-width: 0.25; fill: none; }
      .titleblock-text { font-family: monospace, sans-serif; font-size: 3.2px; fill: #0f172a; }
      .view-label { font-family: monospace, sans-serif; font-size: 3.5px; font-weight: bold; fill: #0f172a; }
      .dim-text { font-family: monospace, sans-serif; font-size: 3.0px; font-weight: bold; fill: #0f172a; text-anchor: middle; }
      .gdt-text { font-family: monospace, sans-serif; font-size: 2.8px; fill: #0f172a; }
    </style>
    <!-- Arrow Marker -->
    <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
      <path d="M 0 2 L 10 5 L 0 8 z" fill="#0f172a"/>
    </marker>
  </defs>

  <!-- Sheet Background -->
  <rect class="sheet-bg" x="0" y="0" width="${width}" height="${height}" />

  <!-- Sheet Border & Grid -->
  <g id="sheet-border">
    <rect class="border-line" x="10" y="10" width="${width - 20}" height="${height - 20}" />
    <rect class="border-line" x="12" y="12" width="${width - 24}" height="${height - 24}" stroke-width="0.35" />
  </g>
`;

    // 1. Title Block
    const tb = sheet.titleBlock;
    const tbDim = DrawingStandardEngine.getSheetDimensions(sheet.size);
    const tbW = tbDim.titleBlockWidthMm;
    const tbH = tbDim.titleBlockHeightMm;
    const tbX = width - 10 - tbW;
    const tbY = height - 10 - tbH;

    svg += `
  <!-- Title Block Layer -->
  <g id="title-block">
    <rect class="border-line" x="${tbX}" y="${tbY}" width="${tbW}" height="${tbH}" stroke-width="0.5" />
    <line class="border-line" x1="${tbX}" y1="${tbY + 20}" x2="${tbX + tbW}" y2="${tbY + 20}" stroke-width="0.35" />
    <line class="border-line" x1="${tbX}" y1="${tbY + 40}" x2="${tbX + tbW}" y2="${tbY + 40}" stroke-width="0.35" />
    <line class="border-line" x1="${tbX + tbW * 0.5}" y1="${tbY}" x2="${tbX + tbW * 0.5}" y2="${tbY + 40}" stroke-width="0.35" />

    <text class="titleblock-text" x="${tbX + 4}" y="${tbY + 7}" font-weight="bold">${tb.companyName}</text>
    <text class="titleblock-text" x="${tbX + 4}" y="${tbY + 15}" font-size="4px" font-weight="bold">${tb.title}</text>
    
    <text class="titleblock-text" x="${tbX + 4}" y="${tbY + 27}">DRW NO: ${tb.drawingNumber}</text>
    <text class="titleblock-text" x="${tbX + 4}" y="${tbY + 35}">REV: ${tb.revision} | STATUS: ${tb.status}</text>
    
    <text class="titleblock-text" x="${tbX + tbW * 0.5 + 4}" y="${tbY + 12}">SCALE: ${tb.sheetScale}</text>
    <text class="titleblock-text" x="${tbX + tbW * 0.5 + 4}" y="${tbY + 22}">MATERIAL: ${tb.material}</text>
    <text class="titleblock-text" x="${tbX + tbW * 0.5 + 4}" y="${tbY + 32}">DATE: ${tb.creationDate}</text>
  </g>
`;

    // 2. Views and Projected Geometry
    sheet.views.forEach((view, vIdx) => {
      svg += `\n  <!-- View: ${view.name} -->\n  <g id="view-${vIdx}-${view.id}">`;
      svg += `\n    <text class="view-label" x="${view.transform.positionOnSheet.x}" y="${view.boundingBox.max.y + 7}" text-anchor="middle">${view.name} (${view.scaleRatio})</text>`;

      // Visible edges
      svg += `\n    <g id="visible-edges-${vIdx}">`;
      view.visibleGeometry.forEach(geom => {
        if (geom.type === 'LINE') {
          svg += `\n      <line class="visible-edge" x1="${geom.p1.x.toFixed(2)}" y1="${geom.p1.y.toFixed(2)}" x2="${geom.p2.x.toFixed(2)}" y2="${geom.p2.y.toFixed(2)}" />`;
        } else if (geom.type === 'ARC') {
          svg += `\n      <circle class="visible-edge" cx="${geom.center.x.toFixed(2)}" cy="${geom.center.y.toFixed(2)}" r="${geom.radius.toFixed(2)}" />`;
        }
      });
      svg += `\n    </g>`;

      // Hidden edges
      if (view.hiddenGeometry.length > 0) {
        svg += `\n    <g id="hidden-edges-${vIdx}">`;
        view.hiddenGeometry.forEach(geom => {
          if (geom.type === 'LINE') {
            svg += `\n      <line class="hidden-edge" x1="${geom.p1.x.toFixed(2)}" y1="${geom.p1.y.toFixed(2)}" x2="${geom.p2.x.toFixed(2)}" y2="${geom.p2.y.toFixed(2)}" />`;
          }
        });
        svg += `\n    </g>`;
      }

      // Centerlines
      if (view.centerlines.length > 0) {
        svg += `\n    <g id="centerlines-${vIdx}">`;
        view.centerlines.forEach(geom => {
          if (geom.type === 'LINE') {
            svg += `\n      <line class="center-line" x1="${geom.p1.x.toFixed(2)}" y1="${geom.p1.y.toFixed(2)}" x2="${geom.p2.x.toFixed(2)}" y2="${geom.p2.y.toFixed(2)}" />`;
          }
        });
        svg += `\n    </g>`;
      }

      // Section Hatches if view is Section
      if (view.type === 'SECTION' && (view as any).hatches) {
        svg += `\n    <g id="hatches-${vIdx}">`;
        (view as any).hatches.forEach((hatch: any) => {
          hatch.lines.forEach((l: any) => {
            svg += `\n      <line class="hatch-line" x1="${l.p1.x.toFixed(2)}" y1="${l.p1.y.toFixed(2)}" x2="${l.p2.x.toFixed(2)}" y2="${l.p2.y.toFixed(2)}" />`;
          });
        });
        svg += `\n    </g>`;
      }

      svg += `\n  </g>`;
    });

    // 3. Dimensions
    if (sheet.dimensions.length > 0) {
      svg += `\n  <!-- Dimensions Layer -->\n  <g id="dimensions-layer">`;
      sheet.dimensions.forEach(dim => {
        const text = DrawingStandardEngine.formatDimensionText(
          dim.measuredValue,
          sheet.standard,
          dim.tolerance,
          dim.prefix,
          dim.suffix
        );

        svg += `\n    <!-- Dim: ${dim.id} -->`;
        svg += `\n    <line class="extension-line" x1="${dim.extensionLine1.p1.x.toFixed(2)}" y1="${dim.extensionLine1.p1.y.toFixed(2)}" x2="${dim.extensionLine1.p2.x.toFixed(2)}" y2="${dim.extensionLine1.p2.y.toFixed(2)}" />`;
        svg += `\n    <line class="extension-line" x1="${dim.extensionLine2.p1.x.toFixed(2)}" y1="${dim.extensionLine2.p1.y.toFixed(2)}" x2="${dim.extensionLine2.p2.x.toFixed(2)}" y2="${dim.extensionLine2.p2.y.toFixed(2)}" />`;
        svg += `\n    <line class="dimension-line" x1="${dim.dimensionLine.p1.x.toFixed(2)}" y1="${dim.dimensionLine.p1.y.toFixed(2)}" x2="${dim.dimensionLine.p2.x.toFixed(2)}" y2="${dim.dimensionLine.p2.y.toFixed(2)}" marker-start="url(#arrow)" marker-end="url(#arrow)" />`;
        svg += `\n    <rect x="${(dim.textPosition.x - 12).toFixed(2)}" y="${(dim.textPosition.y - 3).toFixed(2)}" width="24" height="6" fill="#ffffff" />`;
        svg += `\n    <text class="dim-text" x="${dim.textPosition.x.toFixed(2)}" y="${(dim.textPosition.y + 1.2).toFixed(2)}">${text}</text>`;
      });
      svg += `\n  </g>`;
    }

    svg += `\n</svg>`;
    return svg;
  }

  /**
   * Exports technical drawing to standard AutoCAD DXF format (R12/2000 compatible ASCII).
   */
  public static exportToDXF(sheet: DrawingSheet): string {
    let dxf = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1015
0
ENDSEC
0
SECTION
2
TABLES
0
TABLE
2
LTYPE
0
LTYPE
2
CONTINUOUS
70
0
3
Solid Line
72
65
73
0
40
0.0
0
LTYPE
2
DASHED
70
0
3
Dashed __ __ __
72
65
73
2
40
6.0
49
4.0
49
-2.0
0
LTYPE
2
CENTER
70
0
3
Center _ . _
72
65
73
4
40
16.0
49
10.0
49
-2.0
49
2.0
49
-2.0
0
ENDTAB
0
TABLE
2
LAYER
0
LAYER
2
0
70
0
62
7
6
CONTINUOUS
0
LAYER
2
VISIBLE
70
0
62
7
6
CONTINUOUS
0
LAYER
2
HIDDEN
70
0
62
8
6
DASHED
0
LAYER
2
CENTER
70
0
62
4
6
CENTER
0
LAYER
2
DIMENSIONS
70
0
62
3
6
CONTINUOUS
0
LAYER
2
HATCH
70
0
62
5
6
CONTINUOUS
0
ENDTAB
0
ENDSEC
0
SECTION
2
ENTITIES
`;

    // Iterate Views and output DXF geometry
    sheet.views.forEach(view => {
      // Visible lines
      view.visibleGeometry.forEach(geom => {
        if (geom.type === 'LINE') {
          dxf += `0\nLINE\n8\nVISIBLE\n10\n${geom.p1.x}\n20\n${-geom.p1.y}\n30\n0.0\n11\n${geom.p2.x}\n21\n${-geom.p2.y}\n31\n0.0\n`;
        } else if (geom.type === 'ARC') {
          dxf += `0\nCIRCLE\n8\nVISIBLE\n10\n${geom.center.x}\n20\n${-geom.center.y}\n30\n0.0\n40\n${geom.radius}\n`;
        }
      });

      // Hidden lines
      view.hiddenGeometry.forEach(geom => {
        if (geom.type === 'LINE') {
          dxf += `0\nLINE\n8\nHIDDEN\n10\n${geom.p1.x}\n20\n${-geom.p1.y}\n30\n0.0\n11\n${geom.p2.x}\n21\n${-geom.p2.y}\n31\n0.0\n`;
        }
      });

      // Centerlines
      view.centerlines.forEach(geom => {
        if (geom.type === 'LINE') {
          dxf += `0\nLINE\n8\nCENTER\n10\n${geom.p1.x}\n20\n${-geom.p1.y}\n30\n0.0\n11\n${geom.p2.x}\n21\n${-geom.p2.y}\n31\n0.0\n`;
        }
      });

      // Hatches
      if (view.type === 'SECTION' && (view as any).hatches) {
        (view as any).hatches.forEach((h: any) => {
          h.lines.forEach((l: any) => {
            dxf += `0\nLINE\n8\nHATCH\n10\n${l.p1.x}\n20\n${-l.p1.y}\n30\n0.0\n11\n${l.p2.x}\n21\n${-l.p2.y}\n31\n0.0\n`;
          });
        });
      }
    });

    // Dimensions
    sheet.dimensions.forEach(dim => {
      dxf += `0\nLINE\n8\nDIMENSIONS\n10\n${dim.dimensionLine.p1.x}\n20\n${-dim.dimensionLine.p1.y}\n30\n0.0\n11\n${dim.dimensionLine.p2.x}\n21\n${-dim.dimensionLine.p2.y}\n31\n0.0\n`;
      dxf += `0\nTEXT\n8\nDIMENSIONS\n10\n${dim.textPosition.x}\n20\n${-dim.textPosition.y}\n30\n0.0\n40\n3.0\n1\n${dim.measuredValue.toFixed(1)}\n`;
    });

    dxf += `0\nENDSEC\n0\nEOF\n`;
    return dxf;
  }
}
