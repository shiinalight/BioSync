import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ShoppingCart, Star, Sparkles, Plus, Minus, Trash2 } from "lucide-react";

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  rating: number;
  aiRecommended: boolean;
  description: string;
  emoji: string;
}

const products: Product[] = [
  { id: "1", name: "Vitamin D3 5000IU", category: "Vitamins", price: 14.99, rating: 4.8, aiRecommended: true, description: "Essential for immune support and bone health. 120 softgels.", emoji: "☀️" },
  { id: "2", name: "Omega-3 Fish Oil", category: "Vitamins", price: 24.99, rating: 4.7, aiRecommended: true, description: "Premium EPA/DHA for heart and brain health. 90 capsules.", emoji: "🐟" },
  { id: "3", name: "Whey Protein Isolate", category: "Proteins", price: 39.99, rating: 4.6, aiRecommended: false, description: "25g protein per serving. Vanilla flavor. 30 servings.", emoji: "💪" },
  { id: "4", name: "Plant Protein Blend", category: "Proteins", price: 34.99, rating: 4.5, aiRecommended: false, description: "Pea + rice protein. Chocolate flavor. 28 servings.", emoji: "🌱" },
  { id: "5", name: "Magnesium Glycinate", category: "Recovery", price: 18.99, rating: 4.9, aiRecommended: true, description: "Highly bioavailable. Supports sleep and muscle recovery. 120 caps.", emoji: "🧘" },
  { id: "6", name: "Turmeric Curcumin", category: "Recovery", price: 22.99, rating: 4.6, aiRecommended: false, description: "Anti-inflammatory with BioPerine for absorption. 90 caps.", emoji: "🟡" },
  { id: "7", name: "Melatonin 3mg", category: "Sleep", price: 9.99, rating: 4.4, aiRecommended: false, description: "Natural sleep support. 60 dissolvable tablets.", emoji: "🌙" },
  { id: "8", name: "L-Theanine 200mg", category: "Sleep", price: 16.99, rating: 4.7, aiRecommended: true, description: "Calm focus and better sleep quality. 90 capsules.", emoji: "🍵" },
  { id: "9", name: "Elderberry Gummies", category: "Immunity", price: 19.99, rating: 4.5, aiRecommended: false, description: "Immune support with vitamin C and zinc. 60 gummies.", emoji: "🫐" },
  { id: "10", name: "Zinc Picolinate 30mg", category: "Immunity", price: 11.99, rating: 4.6, aiRecommended: true, description: "Highly absorbable zinc for immune defense. 120 caps.", emoji: "🛡️" },
];

const categories = ["All", "Vitamins", "Proteins", "Recovery", "Sleep", "Immunity"];

interface CartItem {
  product: Product;
  quantity: number;
}

export default function Shop() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);

  const filtered = activeCategory === "All" ? products : products.filter((p) => p.category === activeCategory);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === id ? { ...item, quantity: item.quantity + delta } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Health Shop</h1>
          <p className="text-sm text-muted-foreground mt-1">Supplements & wellness essentials</p>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="relative">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Cart
              {cartCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-[10px]">
                  {cartCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Your Cart ({cartCount})</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-4 flex-1">
              {cart.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Your cart is empty</p>
              )}
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center gap-3">
                  <span className="text-2xl">{item.product.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">${item.product.price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQty(item.product.id, -1)}>
                      {item.quantity === 1 ? <Trash2 className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    </Button>
                    <span className="text-sm w-6 text-center">{item.quantity}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQty(item.product.id, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="border-t border-border pt-4 mt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold">${cartTotal.toFixed(2)}</span>
                </div>
                <Button className="w-full">Checkout</Button>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>

      {/* Categories */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((c) => (
          <Button
            key={c}
            variant={activeCategory === c ? "default" : "outline"}
            size="sm"
            className="rounded-full"
            onClick={() => setActiveCategory(c)}
          >
            {c}
          </Button>
        ))}
      </div>

      {/* Products */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((product, i) => (
            <motion.div
              key={product.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="hover:shadow-md transition-shadow h-full flex flex-col">
                <CardContent className="p-5 flex flex-col flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-3xl">{product.emoji}</span>
                    {product.aiRecommended && (
                      <Badge variant="secondary" className="text-[10px] gap-1 bg-primary/10 text-primary border-0">
                        <Sparkles className="h-3 w-3" /> AI Pick
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-medium text-foreground text-sm">{product.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 flex-1">{product.description}</p>
                  <div className="flex items-center gap-1 mt-3">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span className="text-xs text-muted-foreground">{product.rating}</span>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <span className="text-lg font-semibold text-foreground">${product.price.toFixed(2)}</span>
                    <Button size="sm" onClick={() => addToCart(product)}>
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
