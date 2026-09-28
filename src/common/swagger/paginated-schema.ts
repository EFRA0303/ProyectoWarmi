import { getMetadataArgsStorage } from 'typeorm';

export const entitySchema = (model: Function) => {
  const columns = getMetadataArgsStorage().columns.filter(
    (column) => column.target === model,
  );
  const properties = Object.fromEntries(
    columns.map((column) => {
      const type = column.options.type;
      const typeName = typeof type === 'string' ? type : '';
      const schema: Record<string, unknown> = {
        type:
          typeName === 'boolean'
            ? 'boolean'
            : ['integer', 'int', 'smallint', 'bigint'].includes(typeName)
              ? 'integer'
              : typeName === 'numeric' || typeName === 'decimal'
                ? 'string'
                : 'string',
      };
      if (column.options.enum) schema.enum = Object.values(column.options.enum);
      if (['date', 'timestamptz', 'timestamp'].includes(typeName))
        schema.format = typeName === 'date' ? 'date' : 'date-time';
      if (column.options.nullable) schema.nullable = true;
      return [column.propertyName, schema];
    }),
  );
  const required = columns
    .filter((column) => !column.options.nullable)
    .map((column) => column.propertyName);
  return { type: 'object', properties, required };
};

export const paginatedSchema = (model: Function) => ({
  type: 'object',
  properties: {
    data: { type: 'array', items: entitySchema(model) },
    total: { type: 'integer', example: 1 },
    page: { type: 'integer', example: 1 },
    limit: { type: 'integer', example: 20 },
  },
  required: ['data', 'total', 'page', 'limit'],
});
