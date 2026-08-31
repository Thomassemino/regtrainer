export const money = (n: number) => "$" + n.toLocaleString("es-AR");

export const AC = "#E82828";
export const ACD = "#240608";
export const DIV = "rgba(244,244,245,.13)";
export const SUR = "#101013";

export const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const U = (id: string, w?: number) => "https://images.unsplash.com/photo-" + id + "?fm=jpg&q=70&w=" + (w || 1200) + "&auto=format&fit=crop";

export const PH: Record<string, { src: string; credit: string; href: string }> = {
  hero: { src: U("1526506118085-60ce8714f8c5", 1400), credit: "Edgar Chaparro / Unsplash", href: "https://unsplash.com/@echaparro" },
  retrato: { src: "/img/beto.jpg", credit: "", href: "" },
};
