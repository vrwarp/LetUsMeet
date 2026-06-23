import { useEffect } from "react";

const DEFAULT_TITLE = "LetUsMeet — Private group scheduling that just works";

/**
 * Sets `document.title` to the provided value for the lifetime of the
 * component, restoring the previous title on unmount. Pass a falsy value to
 * leave the current title untouched.
 */
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (!title) return;
    const previousTitle = document.title;
    document.title = title;
    return () => {
      document.title = previousTitle || DEFAULT_TITLE;
    };
  }, [title]);
}

export default useDocumentTitle;
