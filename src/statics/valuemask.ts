export const valueMask = {
    CreateWindow: {
        backgroundPixmap: {
            mask: 0x00000001,
                format: "L",
        },
        backgroundPixel: {
            mask: 0x00000002,
                format: "L",
        },
        borderPixmap: {
            mask: 0x00000004,
                format: "L",
        },
        borderPixel: {
            mask: 0x00000008,
                format: "L",
        },
        bitGravity: {
            mask: 0x00000010,
                format: "Cxxx",
        },
        winGravity: {
            mask: 0x00000020,
                format: "Cxxx",
        },
        backingStore: {
            mask: 0x00000040,
                format: "Cxxx",
        },
        backingPlanes: {
            mask: 0x00000080,
                format: "L",
        },
        backingPixel: {
            mask: 0x00000100,
                format: "L",
        },
        overrideRedirect: {
            mask: 0x00000200,
                format: "Cxxx",
        },
        saveUnder: {
            mask: 0x00000400,
                format: "Cxxx",
        },
        eventMask: {
            mask: 0x00000800,
                format: "L",
        },
        doNotPropagateMask: {
            mask: 0x00001000,
                format: "L",
        },
        colormap: {
            mask: 0x00002000,
                format: "L",
        },
        cursor: {
            mask: 0x00004000,
                format: "L",
        },
    },
    CreateGC: {
        function: {
            // TODO: alias? _function?
            mask: 0x00000001,
            format: "Cxxx",
        },
        planeMask: {
            mask: 0x00000002,
                format: "L",
        },
        foreground: {
            mask: 0x00000004,
                format: "L",
        },
        background: {
            mask: 0x00000008,
                format: "L",
        },
        lineWidth: {
            mask: 0x00000010,
                format: "Sxx",
        },
        lineStyle: {
            mask: 0x00000020,
                format: "Cxxx",
        },
        capStyle: {
            mask: 0x00000040,
                format: "Cxxx",
        },
        joinStyle: {
            mask: 0x00000080,
                format: "Cxxx",
        },
        fillStyle: {
            mask: 0x00000100,
                format: "Cxxx",
        },
        fillRule: {
            mask: 0x00000200,
                format: "Cxxx",
        },
        tile: {
            mask: 0x00000400,
                format: "L",
        },
        stipple: {
            mask: 0x00000800,
                format: "L",
        },
        tileStippleXOrigin: {
            mask: 0x00001000,
                format: "sxx",
        },
        tileStippleYOrigin: {
            mask: 0x00002000,
                format: "sxx",
        },
        font: {
            mask: 0x00004000,
                format: "L",
        },
        subwindowMode: {
            mask: 0x00008000,
                format: "Cxxx",
        },
        graphicsExposures: {
            mask: 0x00010000,
                format: "Cxxx",
        },
        clipXOrigin: {
            mask: 0x00020000,
                format: "Sxx",
        },
        clipYOrigin: {
            mask: 0x00040000,
                format: "Sxx",
        },
        clipMask: {
            mask: 0x00080000,
                format: "L",
        },
        dashOffset: {
            mask: 0x00100000,
                format: "Sxx",
        },
        dashes: {
            mask: 0x00200000,
                format: "Cxxx",
        },
        arcMode: {
            mask: 0x00400000,
                format: "Cxxx",
        },
    },
    ConfigureWindow: {
        x: {
            mask: 0x000001,
                format: "sxx",
        },
        y: {
            mask: 0x000002,
                format: "sxx",
        },
        width: {
            mask: 0x000004,
                format: "Sxx",
        },
        height: {
            mask: 0x000008,
                format: "Sxx",
        },
        borderWidth: {
            mask: 0x000010,
                format: "Sxx",
        },
        sibling: {
            mask: 0x000020,
                format: "L",
        },
        stackMode: {
            mask: 0x000040,
                format: "Cxxx",
        },
    },
};