use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[repr(u8)]
#[derive(Clone, Copy)]
pub enum Cell {
    Dead = 0,
    Alive = 1,
}

#[wasm_bindgen]
pub struct Universe {
    width: u32,
    height: u32,
    cells: Vec<Cell>,
}

impl Universe {
    fn is_alive_at(&self, x: i32, y: i32) -> bool {
        let width = self.width as i32;
        let height = self.height as i32;
        let index = y.rem_euclid(height) * width + x.rem_euclid(width);
        matches!(self.cells[index as usize], Cell::Alive)
    }

    fn count_neighbor_alive(&self, x: i32, y: i32) -> usize {
        #[rustfmt::skip]
        let neighbors = [
            (-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)
        ];

        neighbors
            .into_iter()
            .filter(|(dx, dy)| self.is_alive_at(x + *dx, y + *dy))
            .count()
    }
}

#[wasm_bindgen]
impl Universe {
    pub fn new() -> Self {
        let width = 15;
        let height = 15;

        #[rustfmt::skip]
        let pattern = [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 0, 0,
            0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0,
            0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0,
            0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0,
            0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0,
            0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0,
            0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ];

        let cells = pattern
            .into_iter()
            .map(|i| if i == 1 { Cell::Alive } else { Cell::Dead })
            .collect();

        Self {
            width,
            height,
            cells,
        }
    }

    pub fn tick(&mut self) {
        let mut next = self.cells.clone();

        for y in 0..self.height {
            for x in 0..self.width {
                let index = y * self.width + x;
                let x = x as i32;
                let y = y as i32;

                let is_alive = self.is_alive_at(x, y);
                let neighbor_alive = self.count_neighbor_alive(x, y);

                next[index as usize] = match (is_alive, neighbor_alive) {
                    (true, 2) | (true, 3) | (false, 3) => Cell::Alive,
                    _ => Cell::Dead,
                };
            }
        }

        self.cells = next;
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    pub fn cells(&self) -> *const Cell {
        self.cells.as_ptr()
    }
}
