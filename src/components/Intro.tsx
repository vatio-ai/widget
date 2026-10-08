export function Intro({
  name,
  avatarUrl,
  greeting,
  suggestions,
  onSuggestion
}: {
  name: string;
  avatarUrl: string | null;
  greeting: string | null;
  suggestions: string[];
  onSuggestion: (text: string) => void;
}) {
  return (
    <div id="intro">
      {avatarUrl ? (
        <img className="avatar big" src={avatarUrl} alt="" />
      ) : (
        <span className="avatar big" aria-hidden="true">
          {name.slice(0, 1)}
        </span>
      )}
      <div className="who">{name}</div>
      {greeting ? <div className="greet">{greeting}</div> : null}
      {suggestions.length ? (
        <div id="chips">
          {suggestions.map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => onSuggestion(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
