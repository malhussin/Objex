/**
 * Google Material Icons ligature wrapper.
 * The font is loaded once in the root layout.
 */
export default function Icon({ name, size = 20, className = '', style, ...rest }) {
  return (
    <span
      className={`material-icons ${className}`}
      style={{ fontSize: `${size}px`, width: size, height: size, ...style }}
      aria-hidden="true"
      {...rest}
    >
      {name}
    </span>
  );
}
