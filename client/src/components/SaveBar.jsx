import Glass from '../ds/Glass.jsx';

/**
 * The form's primary action bar: real glass in the slot the tab bar leaves free (forms hide the tab bar, so the page still has only
 * top bar + this bar blurring). On the one form that keeps the tab bar (Aircraft edit) it drops to a solid floor so the blur budget
 * holds; see `.ds-savebar` in ds.css. Sticks above the bottom edge, and falls back into the flow while a field has focus (index.css).
 */
export default function SaveBar({ children }) {
  return <Glass className="save-bar ds-savebar" role="bar">{children}</Glass>;
}
