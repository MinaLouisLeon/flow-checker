// Crosses to the browser: React sends what `toJSON` returns.
export class Amount {
  constructor(readonly cents: number) {}
  toJSON() {
    return this.cents
  }
}

// Doesn't cross: a class instance with no `toJSON`.
export class Money {
  constructor(
    readonly cents: number,
    readonly currency: string,
  ) {}
  format() {
    return `${(this.cents / 100).toFixed(2)} ${this.currency}`
  }
}
