export interface CarouselGridFrame {
  index: number;
  x: number;
  y: number;
  size: number;
}

interface BuildCarouselGridArgs {
  itemCount: number;
  maxCols: number;
  maxRows: number;
  x: number;
  y: number;
  width: number;
  height: number;
  gap: number;
}

function distributeRows(itemCount: number, maxCols: number, maxRows: number): number[] {
  if (itemCount <= 0) return [];

  const safeCols = Math.max(1, Math.floor(maxCols));
  const safeRows = Math.max(1, Math.floor(maxRows));
  const rowsNeeded = Math.min(safeRows, Math.ceil(itemCount / safeCols));

  const rows: number[] = [];
  let remaining = itemCount;

  for (let row = 0; row < rowsNeeded; row += 1) {
    const rowsLeft = rowsNeeded - row;
    const maxForThisRow = Math.min(safeCols, remaining - (rowsLeft - 1));
    const balanced = Math.ceil(remaining / rowsLeft);
    const count = Math.max(1, Math.min(maxForThisRow, balanced));
    rows.push(count);
    remaining -= count;
  }

  return rows;
}

export function buildAdaptiveCarouselGridFrames({
  itemCount,
  maxCols,
  maxRows,
  x,
  y,
  width,
  height,
  gap,
}: BuildCarouselGridArgs): CarouselGridFrame[] {
  const rows = distributeRows(itemCount, maxCols, maxRows);
  if (!rows.length || width <= 0 || height <= 0) return [];

  const safeGap = Math.max(0, gap);
  const rowBandHeight = (height - safeGap * (rows.length - 1)) / rows.length;
  const frames: CarouselGridFrame[] = [];

  let index = 0;
  rows.forEach((itemsInRow, rowIndex) => {
    const availableRowWidth = width - safeGap * (itemsInRow - 1);
    const size = Math.max(1, Math.min(rowBandHeight, availableRowWidth / itemsInRow));
    const rowUsedWidth = size * itemsInRow + safeGap * (itemsInRow - 1);

    const rowStartX = x + (width - rowUsedWidth) / 2;
    const rowStartY = y + rowIndex * (rowBandHeight + safeGap) + (rowBandHeight - size) / 2;

    for (let col = 0; col < itemsInRow; col += 1) {
      frames.push({
        index,
        x: rowStartX + col * (size + safeGap),
        y: rowStartY,
        size,
      });
      index += 1;
    }
  });

  return frames;
}
