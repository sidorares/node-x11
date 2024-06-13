export function toEnum(
  name: string,
  def: Record<string, string | number | null | undefined>,
) {
  return `export enum ${name} {
        ${Object.entries(def)
          .map(([key, value]: [string, string | number | null | undefined]) => {
            return `${!isNaN(parseInt(key)) ? "_" : ""}${key} = ${JSON.stringify(value)}`;
          })
          .join()}
    }`;
}
export function toConst(
  name: string,
  def: Record<string, string | number | null | undefined>,
  useLiteralValue = false,
) {
  return `export const ${name} = {
        ${Object.entries(def)
          .map(([key, value]: [string, string | number | null | undefined]) => {
            return `${!isNaN(parseInt(key)) ? "_" : ""}${key} : ${useLiteralValue ? value : JSON.stringify(value)}`;
          })
          .join()}
    }`;
}
