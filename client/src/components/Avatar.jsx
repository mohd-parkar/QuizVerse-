// deterministic colour per name so a player keeps the same look across screens
function hueOf(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export default function Avatar({ name, size = 44 }) {
  const hue = hueOf(name);
  return (
    <div
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full font-bold uppercase"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        color: `hsl(${hue} 90% 80%)`,
        background: `hsl(${hue} 70% 45% / 0.22)`,
        border: `1px solid hsl(${hue} 70% 60% / 0.4)`,
      }}
    >
      {name.slice(0, 2)}
    </div>
  );
}
