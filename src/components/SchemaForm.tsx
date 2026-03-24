import type { JSONSchema } from '../types';

interface Props {
  schema: JSONSchema;
  formData: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

export default function SchemaForm({ schema, formData, onChange }: Props) {
  const handleChange = (key: string, value: string) => {
    const prop = schema.properties[key];
    let parsed: unknown = value;
    if (prop.type === 'number') parsed = value === '' ? '' : Number(value);
    if (prop.type === 'integer') parsed = value === '' ? '' : parseInt(value, 10);
    onChange({ ...formData, [key]: parsed });
  };

  return (
    <div className="schema-form">
      {Object.entries(schema.properties).map(([key, prop]) => (
        <div className="form-group" key={key}>
          <label htmlFor={`field-${key}`}>
            {prop.title}
            <span className="field-type" aria-hidden="true">{prop.format || prop.type}</span>
          </label>
          {prop._multiline ? (
            <textarea
              id={`field-${key}`}
              value={String(formData[key] ?? '')}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={key}
              rows={3}
            />
          ) : (
            <input
              id={`field-${key}`}
              type={
                prop.format === 'date'
                  ? 'date'
                  : prop.format === 'email'
                  ? 'email'
                  : prop.type === 'number' || prop.type === 'integer'
                  ? 'number'
                  : 'text'
              }
              step={prop.type === 'integer' ? '1' : undefined}
              value={String(formData[key] ?? '')}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={key}
            />
          )}
        </div>
      ))}
    </div>
  );
}
