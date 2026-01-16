# Mobile Design Adaptation: "The C1RCLE" Aesthetic

This guide details how to translate the premium, cinematic web design of "The C1RCLE" into a high-performance mobile app experience.

## 1. The "Command Capsule" (Bottom Navigation)
On the web, the navbar floats at the top. On mobile, we move this to the bottom but keep the **"Floating Glass"** aesthetic.

### The Look
*   **Floating:** It must *not* touch the bottom edge of the screen. It should float `32px` (or `bottom-8`) above the home indicator.
*   **Shape:** Full pill shape (`rounded-full`).
*   **Material:**
    *   **Background:** `bg-black/80` or `bg-[#161616]/90` (slightly more opaque than web to hide complex scrolling content).
    *   **Blur:** `backdrop-blur-xl` (Heavy blur is crucial).
    *   **Border:** `border border-white/10` (The "Diamond Cut" edge).
    *   **Shadow:** `shadow-[0_10px_40px_rgba(0,0,0,0.8)]` (Deep shadow to create lift).

### The Interaction (Active State)
*   **Web:** A sliding pill background follows the cursor.
*   **Mobile:**
    *   **Active Indicator:** A glowing dot or small pill *under* the icon/text, or the icon itself glows `text-iris` (`#F44A22`) with a subtle drop shadow (`shadow-[0_0_15px_rgba(244,74,34,0.4)]`).
    *   **Touch Feedback:** When tapped, the icon should scale down slightly (`scale-90`) and then spring back (`scale-100`). **Haptic feedback** (light impact) is mandatory on tap.

## 2. Gestures > Hovers
The web relies on "Lift on Hover". Mobile relies on **"Press & Response"**.

### Card Interactions
*   **Web:** Card lifts up (`translate-y-[-4px]`) and shadow grows on hover.
*   **Mobile:**
    *   **Touch Down:** Card scales *down* slightly (`scale-[0.98]`) and dims (`opacity-90`). This mimics pressing a physical button.
    *   **Touch Up:** Card springs back to full size.
    *   **Haptics:** Trigger a light haptic tap on `onPressIn`.

### "Swipe" is the new "Scroll"
*   **Carousels:** Instead of grid rows that require clicking "Next", use horizontal scroll views (Carousels) with **snap pagination**.
*   **Feel:** The scroll physics should feel "heavy" and premium, not loose.

## 3. The "Future of Nightlife" Hero Section
Vertical screens require a different approach to the cinematic video background.

### Implementation
*   **Full Screen Video:** The background video should take up the entire screen height (`100vh`) behind the content.
*   **Gradient Overlay:** Use a stronger gradient at the bottom (`bg-gradient-to-t from-black via-black/50 to-transparent`) to ensure the white text is readable against the video.
*   **Typography:**
    *   **Title:** Stack the words "THE" and "C1RCLE" vertically if needed to maintain the massive scale.
    *   **Animation:** Keep the "Gradient Shift" on the text. It looks even better on OLED mobile screens.

## 4. Typography & "Crispness" on Small Screens
Mobile screens have high pixel density (DPI). We can go smaller and sharper.

*   **Uppercase Headers:** Use `text-[10px]` or `text-xs` with `tracking-[0.2em]` (very wide) for kickers and labels (e.g., "TRENDING", "DATE").
*   **Body Text:** Keep it `text-sm` or `text-base` but increase line height (`leading-relaxed`) to let it breathe.
*   **Contrast:** Ensure the "Grey" text is `#E4E2E3` (Gold Dark) and not too dark, as mobile screens are often used in varying light conditions.

## 5. Specific Component Translations

| Web Element | Mobile Equivalent | Implementation Notes |
| :--- | :--- | :--- |
| **Top Navbar** | **Bottom Floating Capsule** | Fixed position, `bottom-8`, `margin-x-auto`. Hide on scroll down (optional) or keep sticky. |
| **Hover Glow** | **Active State Glow** | When a tab is active, it should emit a colored shadow. |
| **Grid Layout** | **Vertical List + Horizontal Carousels** | Don't squeeze 3 columns. Use 1 column (List) or horizontal carousels for categories. |
| **Modal/Dialog** | **Bottom Sheet (Drawer)** | "Buy Ticket" should slide up from the bottom (`rounded-t-3xl`) with a glass backdrop. |
| **Cursor Stickiness** | **Haptic Feedback** | Replace visual stickiness with physical vibration feedback. |

## 6. The "Worthy" Feeling (Mobile Specifics)
*   **Splash Screen:** The app must open with the "C1RCLE" logo pulsing or shimmering. No static white screens.
*   **Transitions:** Pages shouldn't just "appear." They should **slide** or **fade & scale** in. Use `framer-motion` (React Native Reanimated) for shared element transitions (e.g., clicking a flyer expands it to full screen).
*   **Loading:** Never use a default spinner. Use the **Shimmer** effect on skeleton cards.

## Example: Mobile Bottom Nav Code Snippet
```jsx
// The "Capsule" Look
<View className="absolute bottom-8 self-center flex-row bg-[#161616]/90 backdrop-blur-xl border border-white/10 rounded-full px-6 py-4 shadow-[0_10px_40px_rgba(0,0,0,0.8)]">
  {tabs.map(tab => (
    <TouchableOpacity 
      key={tab.name} 
      className="items-center justify-center mx-4"
      onPress={() => handlePress(tab)}
    >
      <Icon 
        name={tab.icon} 
        color={isActive ? '#F44A22' : '#A8AAAC'} 
        style={isActive && { shadowColor: '#F44A22', shadowRadius: 10, shadowOpacity: 0.5 }} 
      />
      {isActive && <View className="w-1 h-1 bg-[#F44A22] rounded-full mt-1" />}
    </TouchableOpacity>
  ))}
</View>
```
