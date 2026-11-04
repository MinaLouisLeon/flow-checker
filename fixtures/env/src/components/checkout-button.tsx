'use client'

// Planted: a secret read in client code. Next leaves it out of the browser bundle, so it is undefined there.
export function CheckoutButton() {
  const pay = () => {
    const key = process.env.STRIPE_SECRET_KEY
    window.alert(key ? 'Paying' : 'Payments are not set up')
  }
  return (
    <button type="button" onClick={pay}>
      Pay
    </button>
  )
}
