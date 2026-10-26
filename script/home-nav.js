const navMenus = document.querySelectorAll('.menu details[name="nav-menu"]');

navMenus.forEach((menu) => {
    menu.querySelector("summary").addEventListener("click", (event) => {
        if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
            event.preventDefault();
        }
    });

    menu.addEventListener("pointerenter", (event) => {
        if (event.pointerType === "mouse" || event.pointerType === "pen") {
            navMenus.forEach((otherMenu) => {
                if (otherMenu !== menu) otherMenu.open = false;
            });
            menu.open = true;
        }
    });

    menu.addEventListener("pointerleave", (event) => {
        if (event.pointerType === "mouse" || event.pointerType === "pen") {
            menu.open = false;
        }
    });
});
