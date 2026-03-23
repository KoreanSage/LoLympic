/**
 * AdSlot — Placeholder component for future ad insertion.
 *
 * Currently renders nothing (null). When you're ready to enable ads:
 *
 * 1. Replace the `return null` below with your ad provider's component.
 *    For example, with Google AdSense:
 *
 *    ```tsx
 *    return (
 *      <div className="ad-slot" data-slot={slot}>
 *        <ins
 *          className="adsbygoogle"
 *          style={{ display: "block" }}
 *          data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
 *          data-ad-slot={slot}
 *          data-ad-format="auto"
 *          data-full-width-responsive="true"
 *        />
 *      </div>
 *    );
 *    ```
 *
 * 2. You can also conditionally render based on environment or feature flags:
 *
 *    ```tsx
 *    const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED === "true";
 *    if (!ADS_ENABLED) return null;
 *    ```
 *
 * 3. The `slot` prop identifies this ad placement (e.g., "feed-1", "feed-2")
 *    so you can configure different ad units per position.
 */

interface AdSlotProps {
  /** Unique identifier for this ad placement (e.g., "feed-1", "feed-2", "sidebar-top") */
  slot: string;
}

export default function AdSlot({ slot: _slot }: AdSlotProps) {
  // Ad rendering is disabled. See the JSDoc comment above for instructions
  // on how to enable ads with your preferred ad provider.
  return null;
}
