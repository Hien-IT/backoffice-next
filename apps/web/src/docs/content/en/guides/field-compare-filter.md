The filter of the Content module can compare two fields of the same item, for example to find products whose **Stock**
is less than their **Minimum Stock**, instead of comparing with a fixed value.

## Who can use it

Every user who can read both fields.

## Steps

1. Open the collection in the **Content** module.
2. Click **Filter**, **Add Filter**, and choose the first field (for example Stock).
3. Choose the operator: equals, doesn't equal, greater than, greater than or equal to, less than, less than or equal to.
4. In the value box, click the compare with a field button (the two-arrow icon) and choose the second field (for example
   Minimum Stock). The value box turns into a chip with the field name.
5. To go back to entering a value, click the chip and choose to enter a value.

![Products collection filtered on Stock less than Minimum Stock: three items left, Linen Shirt, Floral Dress and Wool Scarf](./images/field-compare-filter-1.png)

## Through the API

Write the comparison value as `$FIELD(field_name)`:

```json
{ "stock": { "_lt": "$FIELD(min_stock)" } }
```

See [list items](/docs/api/items#list-items).

## Limits

- Both fields must be in the same type group: number with number, text with text; a date or time only compares with the
  same date or time type.
- Text, identifier and true/false fields only have the equals and doesn't equal operators.
- An item where either field is empty never matches.
- It cannot be used in the permissions of a policy.
