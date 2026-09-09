const path = require('path');

const BASE = path.join(
  __dirname,
  '..',
  '..',
  '대법원, 고등법원, 지방법원, 서울행정법원, 헌법재판소결정, 노동위원회판정례, 행정해석, 지침, 산재심사재결례'
);
const CURATED = path.join(BASE, '들어갈 내용');

// "들어갈 내용" (curated/split content meant to be included) is listed first;
// the top-level files are raw scraper dumps that overlap with the curated
// set. Both are processed, but rows are de-duplicated by case_link (see
// progress tracker), so overlapping raw rows are naturally skipped.
const CSV_FILES = [
  { path: path.join(CURATED, '판례1.csv'), label: '판례1', category: '판례' },
  { path: path.join(CURATED, '판례2.csv'), label: '판례2', category: '판례' },
  { path: path.join(CURATED, '판례3.csv'), label: '판례3', category: '판례' },
  { path: path.join(CURATED, '판례5.csv'), label: '판례5', category: '판례' },
  { path: path.join(CURATED, '지침.csv'), label: '지침', category: '지침' },
  { path: path.join(CURATED, '산재심사 재결례.csv'), label: '산재심사재결례', category: '산재심사재결례' },
  { path: path.join(CURATED, '행정심판.csv'), label: '행정심판', category: '행정심판' },
  { path: path.join(CURATED, '행정해석.csv'), label: '행정해석', category: '행정해석' },
  { path: path.join(BASE, '판례4.csv'), label: '판례4(원본)', category: '판례' },
  { path: path.join(BASE, '판례 RawData_광고제거.csv'), label: '판례RawData(원본)', category: '판례' },
  {
    path: path.join(
      BASE,
      '대법원, 고등법원, 지방법원, 서울행정법원, 헌법재판소 결정, 노동위원회 판정례.csv'
    ),
    label: '대법원등판정례(원본)',
    category: '판례',
  },
];

module.exports = { CSV_FILES };
