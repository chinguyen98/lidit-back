import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

@Entity()
export class Post {
  @PrimaryKey()
  id!: number;

  @Property({ type: 'date' })
  created_at = new Date();

  @Property({ type: 'date', onUpdate: () => new Date() })
  updated_at = new Date();

  @Property({ type: 'text' })
  title: string;
}