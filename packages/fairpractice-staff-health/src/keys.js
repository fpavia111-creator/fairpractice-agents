import { str } from 'fairpractice-core';
/** Item and role names for matching: 'TB Test', 'tb-test' and 'T.B. test' are the same. */
export const credKey = (v) => str(v).toLowerCase().replace(/[^a-z0-9]/g, '');
