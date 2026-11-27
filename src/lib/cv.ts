import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CV_PDF } from '../consts';

/** True once the CV PDF has been added under public/. Links to it are only rendered then. */
export const cvPdfExists = existsSync(join(process.cwd(), 'public', CV_PDF));
