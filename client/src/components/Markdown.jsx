import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// react-markdown never renders raw HTML, so model output cannot inject markup.
const components = {
  p: (props) => <p className="my-2 first:mt-0 last:mb-0" {...props} />,
  ul: (props) => <ul className="my-2 list-disc space-y-1 pl-5" {...props} />,
  ol: (props) => <ol className="my-2 list-decimal space-y-1 pl-5" {...props} />,
  h1: (props) => <h3 className="mb-1 mt-3 text-base font-semibold text-white" {...props} />,
  h2: (props) => <h3 className="mb-1 mt-3 text-base font-semibold text-white" {...props} />,
  h3: (props) => <h4 className="mb-1 mt-3 font-semibold text-white" {...props} />,
  strong: (props) => <strong className="font-semibold text-white" {...props} />,
  a: (props) => <a className="text-violet-300 underline underline-offset-2" target="_blank" rel="noopener noreferrer" {...props} />,
  code: (props) => <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.85em]" {...props} />,
  pre: (props) => (
    <pre className="my-2 overflow-x-auto rounded-xl border border-line bg-black/40 p-3 font-mono text-xs leading-relaxed [&_code]:bg-transparent [&_code]:p-0" {...props} />
  ),
  blockquote: (props) => <blockquote className="my-2 border-l-2 border-accent/60 pl-3 text-muted" {...props} />,
  table: (props) => (
    <div className="my-2 overflow-x-auto"><table className="w-full border-collapse text-left text-xs" {...props} /></div>
  ),
  th: (props) => <th className="border border-line px-2 py-1 font-semibold max-sm:whitespace-nowrap max-sm:wrap-normal" {...props} />,
  td: (props) => <td className="border border-line px-2 py-1 max-sm:whitespace-nowrap max-sm:wrap-normal" {...props} />,
};

export default function Markdown({ children }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{children}</ReactMarkdown>;
}
