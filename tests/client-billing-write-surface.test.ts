import { readdirSync, readFileSync } from 'fs';
import { extname, join } from 'path';
import { describe, expect, it } from 'vitest';

const CLIENT_DIRS = ['components', 'pages', 'services', 'lib', 'contexts', 'hooks'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

function listSourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
            return listSourceFiles(fullPath);
        }

        return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [fullPath] : [];
    });
}

describe('client billing write surface', () => {
    it('does not mutate protected billing tables or call restricted billing RPCs from browser code', () => {
        const sourceFiles = CLIENT_DIRS.flatMap((dir) => listSourceFiles(join(process.cwd(), dir)));
        const violations = sourceFiles.flatMap((file) => {
            const source = readFileSync(file, 'utf8');
            const tableMutationMatches = source.matchAll(
                /\.from\(['"`](user_subscriptions|user_credits|usage_tracking|fact_generation_events|fact_subscription_events)['"`]\)[\s\S]{0,500}\.(insert|upsert|update|delete)\s*\(/g
            );
            const rpcMatches = source.matchAll(
                /\.rpc\(['"`](grant_credits|consume_credits|verify_razorpay_payment)['"`]/g
            );

            return [
                ...Array.from(tableMutationMatches, (match) => `${file}: direct ${match[1]} ${match[2]} call`),
                ...Array.from(rpcMatches, (match) => `${file}: direct ${match[1]} RPC call`),
            ];
        });

        expect(violations).toEqual([]);
    });
});
