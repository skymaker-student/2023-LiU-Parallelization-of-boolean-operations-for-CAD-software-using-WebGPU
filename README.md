# Parallelization of boolean operations for CAD software using WebGPU

## Run

Run the following commands in the project:

```
npm i
npm run dev
```

## Abstract

This project is about finding ways to improve performance of a
Computer-Aided-Design (CAD) application running in the web browser. With the new
Web API [WebGPU](https://www.w3.org/TR/webgpu/), it is now possible to use the GPU to accelerate
calculations for CAD applications in the web. In this project, we tried to find if using
the GPU could yield significant performance improvements and if they are worth
implementing. Typical tasks for a CAD application are `split` and `union`, used for finding
intersections and combining shapes in geometry, which we parallelized during this project.
Our final implementation utilized lazy evaluation and the HistoPyramid data structure,
to compete with a state-of-the-art line-sweep based algorithm called 
[Polygon Clipping](https://github.com/mfogel/polygon-clipping). Although the Polygon Clipping
intersection is still faster than our implementations in most cases, we found that WebGPU can still 
give significant performance boosts.


## Link to thesis

[*LiU diva-portal: Parallelization of boolean operations for CAD Software using WebGPU*](https://liu.diva-portal.org/smash/record.jsf?pid=diva2%3A1792421&dswid=-3359)


## Authors

- Max Helmrich  (maxhe938)
- Linus Käll    (linka231)
